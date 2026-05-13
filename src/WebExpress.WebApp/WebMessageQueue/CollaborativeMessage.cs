using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebMessageQueue
{
    /// <summary>
    /// Specialized <see cref="IMessage"/> implementation used by the
    /// collaborative pipeline. In contrast to <see cref="Message"/> it
    /// preserves every additional top-level field of the originating client
    /// payload (such as <c>containerId</c>, <c>userId</c>, <c>x</c>,
    /// <c>y</c>, <c>status</c>) by writing them back as siblings of the
    /// standard routing fields. This is required because the client-side
    /// <c>CollaborativeCtrl</c> reads these fields directly from the message
    /// root (e.g. <c>payload.containerId</c>) instead of from a nested
    /// metadata object.
    /// </summary>
    public sealed class CollaborativeMessage : IMessage
    {
        /// <summary>
        /// Gets the application defined message type.
        /// </summary>
        public string Type { get; }

        /// <summary>
        /// Gets the unique message identifier used for deduplication or
        /// request/response correlation.
        /// </summary>
        public string MessageId { get; }

        /// <summary>
        /// Gets the identifier of the application this message belongs to,
        /// if applicable.
        /// </summary>
        public string ApplicationId { get; }

        /// <summary>
        /// Gets the socket endpoint identifier this message originates from
        /// or is targeted to.
        /// </summary>
        public string SocketId { get; }

        /// <summary>
        /// Gets the connection identifier assigned by the socket manager.
        /// </summary>
        public string ConnectionId { get; }

        /// <summary>
        /// Gets the optional sender identifier associated with this message.
        /// </summary>
        public string Sender { get; }

        /// <summary>
        /// Gets the UTC timestamp indicating when the message instance was
        /// created.
        /// </summary>
        public DateTime Timestamp { get; }

        /// <summary>
        /// Gets the metadata dictionary containing arbitrary key/value pairs.
        /// The dictionary is immutable and never <c>null</c>.
        /// </summary>
        public IDictionary<string, string> Meta { get; }

        /// <summary>
        /// Gets the additional top-level properties forwarded verbatim from
        /// the originating client payload. These are written back as siblings
        /// of the standard fields during JSON serialization, which keeps the
        /// public wire format flat for the JavaScript control.
        /// </summary>
        /// <remarks>
        /// The property is not bound through the constructor on purpose:
        /// <c>System.Text.Json</c> rejects <see cref="JsonExtensionDataAttribute"/>
        /// on a property that participates in the deserialization constructor.
        /// </remarks>
        [JsonExtensionData]
        public IDictionary<string, JsonElement> AdditionalProperties { get; set; } = new Dictionary<string, JsonElement>();

        /// <summary>
        /// Initializes a new instance of the <see cref="CollaborativeMessage"/>
        /// class.
        /// </summary>
        /// <param name="type">
        /// The application defined message type. Must not be <c>null</c>.
        /// </param>
        /// <param name="messageId">
        /// The unique message identifier. If <c>null</c>, a new identifier is
        /// generated.
        /// </param>
        /// <param name="applicationId">
        /// The application identifier this message belongs to, if applicable.
        /// </param>
        /// <param name="socketId">
        /// The socket endpoint identifier this message originates from or
        /// targets.
        /// </param>
        /// <param name="connectionId">
        /// The connection identifier assigned by the socket manager.
        /// </param>
        /// <param name="sender">
        /// Optional sender identifier.
        /// </param>
        /// <param name="timestamp">
        /// The UTC timestamp of message creation. If <c>null</c>, the current
        /// UTC time is used.
        /// </param>
        /// <param name="meta">
        /// Optional metadata dictionary. If <c>null</c>, an empty dictionary
        /// is used.
        /// </param>
        /// <exception cref="ArgumentNullException">
        /// Thrown when <paramref name="type"/> is <c>null</c>.
        /// </exception>
        public CollaborativeMessage
        (
            string type,
            string messageId = null,
            string applicationId = null,
            string socketId = null,
            string connectionId = null,
            string sender = null,
            DateTime? timestamp = null,
            IDictionary<string, string> meta = null
        )
        {
            Type = type ?? throw new ArgumentNullException(nameof(type));
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
