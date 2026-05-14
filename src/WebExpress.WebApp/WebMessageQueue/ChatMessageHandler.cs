using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace WebExpress.WebApp.WebMessageQueue
{
    /// <summary>
    /// Default implementation of <see cref="IChatMessageHandler"/>.
    /// </summary>
    /// <remarks>
    /// Responsibilities:
    /// <list type="bullet">
    ///   <item>Parsing the raw JSON payload received from a client.</item>
    ///   <item>Validating the chat message type and the presence of a
    ///         <c>channelId</c>.</item>
    ///   <item>For <c>chat.message</c>: server-assigns the
    ///         <c>messageId</c>, enriches the payload with routing info,
    ///         appends to <see cref="ChatChannelStore"/> and broadcasts the
    ///         authoritative copy to every connected client of the
    ///         application — the receiver filters by channel id.</item>
    ///   <item>For <c>chat.history.request</c>: replays the buffered
    ///         backlog for the requested channel back to the originating
    ///         socket only.</item>
    /// </list>
    /// The structure intentionally mirrors
    /// <see cref="CollaborativeMessageHandler"/> so future message families
    /// can follow the same pattern.
    /// </remarks>
    public sealed class ChatMessageHandler : IChatMessageHandler
    {
        private static readonly HashSet<string> _reservedFieldNames = new(StringComparer.OrdinalIgnoreCase)
        {
            "type",
            "messageId", "messageid",
            "applicationId", "applicationid",
            "socketId", "socketid",
            "connectionId", "connectionid",
            "sender",
            "timestamp",
            "meta"
        };

        private readonly IMessageQueueManager _messageQueueManager;
        private readonly ChatChannelStore _channelStore;

        /// <summary>
        /// Initializes a new instance.
        /// </summary>
        /// <param name="messageQueueManager">
        /// The message queue manager used to distribute chat messages.
        /// </param>
        /// <param name="channelStore">
        /// The channel store that retains recent messages for replay.
        /// </param>
        public ChatMessageHandler(IMessageQueueManager messageQueueManager, ChatChannelStore channelStore)
        {
            _messageQueueManager = messageQueueManager
                ?? throw new ArgumentNullException(nameof(messageQueueManager));
            _channelStore = channelStore
                ?? throw new ArgumentNullException(nameof(channelStore));
        }

        /// <summary>
        /// Routes the inbound chat payload to broadcast or history replay.
        /// </summary>
        /// <param name="source">The originating socket.</param>
        /// <param name="rawPayload">The raw text payload.</param>
        /// <param name="cancellationToken">A cancellation token.</param>
        public async Task HandleAsync
        (
            IMessageQueueSocket source,
            string rawPayload,
            CancellationToken cancellationToken = default
        )
        {
            ArgumentNullException.ThrowIfNull(source);

            if (string.IsNullOrWhiteSpace(rawPayload))
            {
                return;
            }

            JsonDocument document;
            try
            {
                document = JsonDocument.Parse(rawPayload);
            }
            catch (JsonException)
            {
                return;
            }

            using (document)
            {
                var root = document.RootElement;
                if (root.ValueKind != JsonValueKind.Object)
                {
                    return;
                }

                if (!TryGetString(root, "type", out var type))
                {
                    return;
                }

                if (!ChatMessageTypes.IsChat(type))
                {
                    return;
                }

                if (!TryGetString(root, "channelId", out var channelId))
                {
                    return;
                }

                if (type == ChatMessageTypes.Message)
                {
                    await BroadcastMessageAsync(source, root, channelId, cancellationToken);
                    return;
                }

                if (type == ChatMessageTypes.HistoryRequest)
                {
                    await ReplayHistoryAsync(source, channelId, cancellationToken);
                }
            }
        }

        /// <summary>
        /// Builds the authoritative <see cref="ChatMessage"/>, stores it in
        /// the channel history and broadcasts it to every connected client
        /// of the application.
        /// </summary>
        private async Task BroadcastMessageAsync
        (
            IMessageQueueSocket source,
            JsonElement root,
            string channelId,
            CancellationToken cancellationToken
        )
        {
            var additional = new Dictionary<string, JsonElement>(StringComparer.Ordinal);
            foreach (var property in root.EnumerateObject())
            {
                if (_reservedFieldNames.Contains(property.Name))
                {
                    continue;
                }
                additional[property.Name] = property.Value.Clone();
            }

            TryGetString(root, "sender", out var sender);
            TryGetString(root, "applicationId", out var applicationId);
            TryGetString(root, "socketId", out var socketId);

            var session = source.ClientSession;
            var connectionId = session?.ConnectionId.ToString("N");
            var messageId = Guid.NewGuid().ToString("N");

            var message = new ChatMessage
            (
                type: ChatMessageTypes.Message,
                messageId: messageId,
                applicationId: applicationId ?? session?.ApplicationContext?.ApplicationId,
                socketId: socketId,
                connectionId: connectionId,
                sender: sender,
                timestamp: DateTime.UtcNow
            )
            {
                AdditionalProperties = additional
            };

            // persist for late joiners / reconnects
            _channelStore.Append(channelId, messageId, SerializeAsElement(message));

            // broadcast within the originating application; receivers filter
            // by channel id on the client side
            var address = new AddressApplication(session?.ApplicationContext);
            await _messageQueueManager.SendAsync(address, message, cancellationToken);
        }

        /// <summary>
        /// Sends every buffered message of the requested channel back to
        /// the originating socket so the client can render the recent
        /// backlog on initial load or on reconnect.
        /// </summary>
        private async Task ReplayHistoryAsync
        (
            IMessageQueueSocket source,
            string channelId,
            CancellationToken cancellationToken
        )
        {
            foreach (var stored in _channelStore.GetHistory(channelId))
            {
                var message = BuildReplay(stored);
                try
                {
                    await source.SendAsync(message, cancellationToken);
                }
                catch
                {
                    // one dead connection must not abort the replay
                }
            }
        }

        /// <summary>
        /// Reconstructs a <see cref="ChatMessage"/> from a stored payload
        /// so the client can dedupe by message id when it appears via both
        /// live broadcast and history replay.
        /// </summary>
        private static ChatMessage BuildReplay(ChatStoredMessage stored)
        {
            var root = stored.Payload;
            string GetString(string name)
            {
                if (root.TryGetProperty(name, out var element)
                    && element.ValueKind == JsonValueKind.String)
                {
                    return element.GetString();
                }
                return null;
            }

            DateTime timestamp = DateTime.UtcNow;
            if (root.TryGetProperty("timestamp", out var ts)
                && ts.ValueKind == JsonValueKind.String
                && DateTime.TryParse(ts.GetString(), out var parsed))
            {
                timestamp = parsed;
            }

            var additional = new Dictionary<string, JsonElement>(StringComparer.Ordinal);
            foreach (var property in root.EnumerateObject())
            {
                if (_reservedFieldNames.Contains(property.Name))
                {
                    continue;
                }
                additional[property.Name] = property.Value.Clone();
            }

            return new ChatMessage
            (
                type: ChatMessageTypes.Message,
                messageId: stored.MessageId,
                applicationId: GetString("applicationId") ?? GetString("applicationid"),
                socketId: GetString("socketId") ?? GetString("socketid"),
                connectionId: GetString("connectionId") ?? GetString("connectionid"),
                sender: GetString("sender"),
                timestamp: timestamp
            )
            {
                AdditionalProperties = additional
            };
        }

        /// <summary>
        /// Serializes the message into a <see cref="JsonElement"/> for
        /// persistence. The element is detached from any underlying
        /// document buffer so it survives later parses.
        /// </summary>
        private static JsonElement SerializeAsElement(IMessage message)
        {
            using var document = JsonDocument.Parse(message.ToJson());
            return document.RootElement.Clone();
        }

        /// <summary>
        /// Reads a string property from the JSON root.
        /// </summary>
        private static bool TryGetString(JsonElement root, string propertyName, out string value)
        {
            value = null;
            if (!root.TryGetProperty(propertyName, out var element))
            {
                return false;
            }
            if (element.ValueKind != JsonValueKind.String)
            {
                return false;
            }
            value = element.GetString();
            return !string.IsNullOrEmpty(value);
        }
    }
}
