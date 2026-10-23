using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using WebExpress.WebCore.WebCluster;

namespace WebExpress.WebApp.WebMessageQueue
{
    /// <summary>
    /// In-memory ring buffer that retains the most recent chat messages per
    /// channel so a freshly joining (or reconnecting) client receives the
    /// recent backlog when it requests it. The store is intentionally
    /// volatile — for durable history a real persistence layer would be
    /// plugged in here. Once several instances share a cluster store the
    /// history is kept there instead, since the members of a channel are
    /// spread over every instance and each must see the same backlog.
    /// </summary>
    public sealed class ChatChannelStore
    {
        private readonly ConcurrentDictionary<string, ChannelBuffer> _channels = new(StringComparer.OrdinalIgnoreCase);
        private readonly int _capacityPerChannel;
        private readonly Func<IClusterStore> _sharedStore;

        // the history of a channel nobody wrote to for a week is not worth keeping in shared storage
        private static readonly TimeSpan SharedLifetime = TimeSpan.FromDays(7);

        /// <summary>
        /// Initializes a new instance.
        /// </summary>
        /// <param name="capacityPerChannel">
        /// Maximum number of messages retained per channel. The buffer
        /// drops the oldest entry once this limit is exceeded.
        /// </param>
        /// <param name="sharedStore">
        /// Returns the cluster store while instances share one, or null
        /// while the history stays in this process.
        /// </param>
        public ChatChannelStore(int capacityPerChannel = 200, Func<IClusterStore> sharedStore = null)
        {
            _sharedStore = sharedStore;

            if (capacityPerChannel <= 0)
            {
                throw new ArgumentOutOfRangeException(nameof(capacityPerChannel));
            }
            _capacityPerChannel = capacityPerChannel;
        }

        /// <summary>
        /// Appends a message to the channel buffer. The payload is stored
        /// as a cloned <see cref="JsonElement"/> so the consumers can
        /// re-emit it without reparsing.
        /// </summary>
        /// <param name="channelId">The channel id. Cannot be null or empty.</param>
        /// <param name="messageId">The server-assigned message id.</param>
        /// <param name="payload">The cloned envelope payload.</param>
        public void Append(string channelId, string messageId, JsonElement payload)
        {
            if (string.IsNullOrEmpty(channelId) || string.IsNullOrEmpty(messageId))
            {
                return;
            }

            if (_sharedStore?.Invoke() is { } store)
            {
                AppendShared(store, channelId, messageId, payload);

                return;
            }

            var buffer = _channels.GetOrAdd(channelId, _ => new ChannelBuffer(_capacityPerChannel));
            buffer.Append(messageId, payload);
        }

        /// <summary>
        /// Returns a snapshot of the buffered messages for the specified
        /// channel in insertion order. Empty enumerable when the channel
        /// is unknown.
        /// </summary>
        /// <param name="channelId">The channel id.</param>
        public IEnumerable<ChatStoredMessage> GetHistory(string channelId)
        {
            if (string.IsNullOrEmpty(channelId))
            {
                return [];
            }
            if (_sharedStore?.Invoke() is { } store)
            {
                return ReadShared(store, channelId).Select(x => x.Message).ToArray();
            }

            if (!_channels.TryGetValue(channelId, out var buffer))
            {
                return [];
            }
            return buffer.Snapshot();
        }

        /// <summary>
        /// Appends a message to the shared history and trims it to the capacity. Every message is
        /// an entry of its own, so instances appending at the same time never overwrite each other.
        /// </summary>
        /// <param name="store">The cluster store.</param>
        /// <param name="channelId">The channel id.</param>
        /// <param name="messageId">The message id.</param>
        /// <param name="payload">The envelope payload.</param>
        private void AppendShared(IClusterStore store, string channelId, string messageId, JsonElement payload)
        {
            var scope = Scope(channelId);

            // the tick prefix orders the entries; the message id keeps two in the same tick apart
            var key = DateTime.UtcNow.Ticks.ToString("D19", CultureInfo.InvariantCulture) + "/" + messageId;
            var value = JsonSerializer.SerializeToUtf8Bytes(new SharedEntry { MessageId = messageId, Payload = payload });

            store.Set(scope, key, value, SharedLifetime);

            if (store.Count(scope) > _capacityPerChannel)
            {
                foreach (var stale in ReadShared(store, channelId).SkipLast(_capacityPerChannel))
                {
                    store.Remove(scope, stale.Key);
                }
            }
        }

        /// <summary>
        /// Reads the shared history of a channel, oldest first.
        /// </summary>
        /// <param name="store">The cluster store.</param>
        /// <param name="channelId">The channel id.</param>
        /// <returns>The entries with their store keys.</returns>
        private static List<(string Key, ChatStoredMessage Message)> ReadShared(IClusterStore store, string channelId)
        {
            var result = new List<(string Key, ChatStoredMessage Message)>();

            foreach (var item in store.List(Scope(channelId)).OrderBy(x => x.Key, StringComparer.Ordinal))
            {
                try
                {
                    var entry = JsonSerializer.Deserialize<SharedEntry>(item.Value);

                    if (entry?.MessageId is not null)
                    {
                        result.Add((item.Key, new ChatStoredMessage(entry.MessageId, entry.Payload)));
                    }
                }
                catch (JsonException)
                {
                    // an unreadable entry is skipped rather than costing the whole backlog
                }
            }

            return result;
        }

        /// <summary>
        /// Returns the store scope of a channel. Channel ids come from clients, so the scope is a
        /// hash: it always forms a valid scope name and never collides across case variants the
        /// in-memory buffer treats as one channel.
        /// </summary>
        /// <param name="channelId">The channel id.</param>
        /// <returns>The scope name.</returns>
        private static string Scope(string channelId)
        {
            var hash = SHA256.HashData(Encoding.UTF8.GetBytes(channelId.ToLowerInvariant()));

            return "chat-" + Convert.ToHexString(hash, 0, 16).ToLowerInvariant();
        }

        /// <summary>
        /// The stored form of a chat message.
        /// </summary>
        private sealed class SharedEntry
        {
            /// <summary>
            /// Gets or sets the message id.
            /// </summary>
            public string MessageId { get; set; }

            /// <summary>
            /// Gets or sets the envelope payload.
            /// </summary>
            public JsonElement Payload { get; set; }
        }

        /// <summary>
        /// Backing storage for a single channel.
        /// </summary>
        private sealed class ChannelBuffer
        {
            private readonly int _capacity;
            private readonly LinkedList<ChatStoredMessage> _messages = new();
            private readonly object _gate = new();

            public ChannelBuffer(int capacity)
            {
                _capacity = capacity;
            }

            public void Append(string messageId, JsonElement payload)
            {
                lock (_gate)
                {
                    _messages.AddLast(new ChatStoredMessage(messageId, payload));
                    while (_messages.Count > _capacity)
                    {
                        _messages.RemoveFirst();
                    }
                }
            }

            public IEnumerable<ChatStoredMessage> Snapshot()
            {
                lock (_gate)
                {
                    return _messages.ToArray();
                }
            }
        }
    }

    /// <summary>
    /// A chat message stored in the channel ring buffer.
    /// </summary>
    public sealed class ChatStoredMessage
    {
        /// <summary>
        /// Gets the server-assigned message id.
        /// </summary>
        public string MessageId { get; }

        /// <summary>
        /// Gets the cloned JSON payload exactly as it was broadcast.
        /// </summary>
        public JsonElement Payload { get; }

        /// <summary>
        /// Initializes a new instance.
        /// </summary>
        public ChatStoredMessage(string messageId, JsonElement payload)
        {
            MessageId = messageId;
            Payload = payload;
        }
    }
}
