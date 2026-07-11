using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace WebExpress.WebApp.WebMessageQueue
{
    /// <summary>
    /// Default implementation of <see cref="ICollaborativeMessageHandler"/>.
    /// </summary>
    /// <remarks>
    /// Responsibilities of this handler:
    /// <list type="bullet">
    ///   <item>Parsing the raw JSON payload received from the client.</item>
    ///   <item>Validating that the payload represents a known collaborative
    ///         message type and contains the minimum metadata required to be
    ///         routed (in particular the container id).</item>
    ///   <item>Translating the payload into the internal
    ///         <see cref="IMessage"/> model and enriching it with routing
    ///         information taken from the originating socket.</item>
    ///   <item>Broadcasting the resulting message to all peers that share at
    ///         least one domain with the sender, while excluding the sender
    ///         itself.</item>
    /// </list>
    /// The class is intentionally decoupled from
    /// <see cref="MessageQueueSocket"/> so that the socket implementation
    /// remains a generic transport that delegates to specialized handlers.
    /// </remarks>
    public sealed class CollaborativeMessageHandler : ICollaborativeMessageHandler
    {
        private readonly IMessageQueueManager _messageQueueManager;

        /// <summary>
        /// Initializes a new instance of the
        /// <see cref="CollaborativeMessageHandler"/> class.
        /// </summary>
        /// <param name="messageQueueManager">
        /// The message queue manager used to distribute collaborative
        /// messages to the other connected clients. Cannot be <c>null</c>.
        /// </param>
        /// <exception cref="ArgumentNullException">
        /// Thrown when <paramref name="messageQueueManager"/> is <c>null</c>.
        /// </exception>
        public CollaborativeMessageHandler(IMessageQueueManager messageQueueManager)
        {
            _messageQueueManager = messageQueueManager
                ?? throw new ArgumentNullException(nameof(messageQueueManager));
        }

        /// <summary>
        /// Interprets, validates and forwards the specified collaborative
        /// payload to all clients that are part of the same collaboration
        /// group as the originating socket.
        /// </summary>
        /// <param name="source">
        /// The socket that received the raw message. Cannot be <c>null</c>.
        /// </param>
        /// <param name="rawPayload">
        /// The raw text payload as received from the client. Cannot be
        /// <c>null</c>.
        /// </param>
        /// <param name="cancellationToken">
        /// A token that propagates notification of request cancellation.
        /// </param>
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

            if (!TryBuildMessage(rawPayload, source, out var message))
            {
                return;
            }

            var address = new CollaborativeBroadcastAddress(source.ClientSession);

            await _messageQueueManager
                .SendAsync(address, message, cancellationToken);
        }

        /// <summary>
        /// Property names that are mapped onto explicit <see cref="IMessage"/>
        /// members. They must be skipped when collecting the extension data
        /// so that the resulting JSON does not contain duplicate keys.
        /// </summary>
        private static readonly HashSet<string> _reservedFieldNames = new
        (
            StringComparer.OrdinalIgnoreCase
        )
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

        /// <summary>
        /// Attempts to interpret and validate the raw payload, then constructs
        /// the <see cref="CollaborativeMessage"/> to be broadcast. Every
        /// top-level field of the client payload (such as <c>containerId</c>,
        /// <c>userId</c>, <c>x</c>, <c>y</c>, <c>status</c>) is forwarded
        /// verbatim so that the JS controller can read it directly from the
        /// received object.
        /// </summary>
        /// <param name="rawPayload">The raw JSON string.</param>
        /// <param name="source">The socket that received the payload.</param>
        /// <param name="message">The constructed message on success.</param>
        /// <returns>
        /// <c>true</c> if the payload was a well formed collaborative message
        /// of a known type; otherwise <c>false</c>.
        /// </returns>
        private static bool TryBuildMessage(string rawPayload, IMessageQueueSocket source, out IMessage message)
        {
            message = null;

            JsonDocument document;
            try
            {
                document = JsonDocument.Parse(rawPayload);
            }
            catch (JsonException)
            {
                return false;
            }

            using (document)
            {
                var root = document.RootElement;
                if (root.ValueKind != JsonValueKind.Object)
                {
                    return false;
                }

                if (!TryGetString(root, "type", out var type))
                {
                    return false;
                }

                if (!CollaborativeMessageTypes.IsCollaborative(type))
                {
                    return false;
                }

                if (!IsKnownType(type))
                {
                    return false;
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

                TryGetString(root, "sender", out var sender);
                TryGetString(root, "applicationId", out var applicationId);
                TryGetString(root, "socketId", out var socketId);

                message = new CollaborativeMessage
                (
                    type: type,
                    applicationId: applicationId,
                    socketId: socketId,
                    connectionId: source.ClientSession?.ConnectionId.ToString("N"),
                    sender: sender,
                    timestamp: DateTime.UtcNow
                )
                {
                    AdditionalProperties = additional
                };

                return true;
            }
        }

        /// <summary>
        /// Reads a string property from the JSON root, returning <c>false</c>
        /// when the property is missing or not a string.
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

        /// <summary>
        /// Validates the message type against the set of well known
        /// collaborative type identifiers.
        /// </summary>
        private static bool IsKnownType(string type)
        {
            return type == CollaborativeMessageTypes.Presence
                || type == CollaborativeMessageTypes.Cursor
                || type == CollaborativeMessageTypes.Input
                || type == CollaborativeMessageTypes.Caret;
        }

        /// <summary>
        /// Addressing rule that selects every peer that shares at least one
        /// domain with the originating session, while excluding the sender
        /// itself.
        /// </summary>
        private sealed class CollaborativeBroadcastAddress : IAddress
        {
            private readonly Guid _senderConnectionId;
            private readonly HashSet<string> _domains;

            /// <summary>
            /// Initializes the address from the sender session.
            /// </summary>
            /// <param name="senderSession">The originating client session.</param>
            public CollaborativeBroadcastAddress(IClientSession senderSession)
            {
                _senderConnectionId = senderSession?.ConnectionId ?? Guid.Empty;
                _domains = new HashSet<string>
                (
                    senderSession?.Domains ?? Enumerable.Empty<string>(),
                    StringComparer.OrdinalIgnoreCase
                );
            }

            /// <summary>
            /// Determines whether the candidate session should receive the
            /// broadcast message.
            /// </summary>
            /// <param name="session">The candidate client session.</param>
            /// <returns>
            /// <c>true</c> if the candidate shares at least one domain with
            /// the sender and is not the sender itself.
            /// </returns>
            public bool Matches(IClientSession session)
            {
                if (session == null)
                {
                    return false;
                }

                if (session.ConnectionId == _senderConnectionId)
                {
                    return false;
                }

                if (_domains.Count == 0)
                {
                    return true;
                }

                return session.Domains?.Any(d => _domains.Contains(d)) ?? false;
            }
        }
    }
}
