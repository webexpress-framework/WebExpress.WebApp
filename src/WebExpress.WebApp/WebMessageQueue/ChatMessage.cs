using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebMessageQueue
{
    /// <summary>
    /// Wire-format envelope used to deliver a chat message from the server
    /// to all participants of a channel. Every top-level field of the
    /// incoming client payload (<c>channelId</c>, <c>userId</c>,
    /// <c>userName</c>, <c>userColor</c>, <c>body</c>, …) is preserved via
    /// <see cref="JsonExtensionDataAttribute"/> so the JS controller can
    /// read it directly from the broadcast root.
    /// </summary>
    public sealed class ChatMessage : IMessage
    {
        /// <summary>
        /// Gets the application-defined message type.
        /// </summary>
        public string Type { get; }

        /// <summary>
        /// Gets the unique message identifier assigned by the server.
        /// </summary>
        public string MessageId { get; }

        /// <summary>
        /// Gets the application id.
        /// </summary>
        public string ApplicationId { get; }

        /// <summary>
        /// Gets the socket endpoint identifier (unused for chat).
        /// </summary>
        public string SocketId { get; }

        /// <summary>
        /// Gets the connection id of the originating socket. Echoed back
        /// so participants can detect their own messages reliably.
        /// </summary>
        public string ConnectionId { get; }

        /// <summary>
        /// Gets the optional sender identifier.
        /// </summary>
        public string Sender { get; }

        /// <summary>
        /// Gets the UTC creation timestamp of this envelope.
        /// </summary>
        public DateTime Timestamp { get; }

        /// <summary>
        /// Gets the metadata dictionary required by <see cref="IMessage"/>.
        /// </summary>
        public IDictionary<string, string> Meta { get; }

        /// <summary>
        /// Gets the additional top-level properties forwarded verbatim
        /// from the originating client payload (<c>channelId</c>,
        /// <c>userId</c>, <c>userName</c>, <c>userColor</c>, <c>body</c>,
        /// <c>ts</c>, …). Written back as JSON siblings during
        /// serialization.
        /// </summary>
        [JsonExtensionData]
        public IDictionary<string, JsonElement> AdditionalProperties { get; set; } = new Dictionary<string, JsonElement>();

        /// <summary>
        /// Initializes a new instance.
        /// </summary>
        public ChatMessage
        (
            string type = null,
            string messageId = null,
            string applicationId = null,
            string socketId = null,
            string connectionId = null,
            string sender = null,
            DateTime? timestamp = null,
            IDictionary<string, string> meta = null
        )
        {
            Type = type ?? ChatMessageTypes.Message;
            MessageId = messageId ?? Guid.NewGuid().ToString("N");
            ApplicationId = applicationId;
            SocketId = socketId;
            ConnectionId = connectionId;
            Sender = sender;
            Timestamp = timestamp ?? DateTime.UtcNow;
            Meta = meta is not null
                ? new Dictionary<string, string>(meta)
                : [];
        }
    }
}
