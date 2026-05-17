using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;

namespace WebExpress.WebApp.WebMessageQueue
{
    /// <summary>
    /// In-memory ring buffer that retains the most recent chat messages per
    /// channel so a freshly joining (or reconnecting) client receives the
    /// recent backlog when it requests it. The store is intentionally
    /// volatile — for durable history a real persistence layer would be
    /// plugged in here.
    /// </summary>
    public sealed class ChatChannelStore
    {
        private readonly ConcurrentDictionary<string, ChannelBuffer> _channels = new(StringComparer.OrdinalIgnoreCase);
        private readonly int _capacityPerChannel;

        /// <summary>
        /// Initializes a new instance.
        /// </summary>
        /// <param name="capacityPerChannel">
        /// Maximum number of messages retained per channel. The buffer
        /// drops the oldest entry once this limit is exceeded.
        /// </param>
        public ChatChannelStore(int capacityPerChannel = 200)
        {
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
            if (!_channels.TryGetValue(channelId, out var buffer))
            {
                return [];
            }
            return buffer.Snapshot();
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
