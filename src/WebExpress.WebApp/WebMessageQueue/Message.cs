using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebMessageQueue
{
    /// <summary>
    /// Default immutable implementation of <see cref="IMessage"/>.
    /// Represents a structured WebSocket message containing routing metadata
    /// and optional application-defined information.
    /// </summary>
    public class Message : IMessage
    {
        /// <summary>
        /// Returns the application-defined message type used for routing and dispatching.
        /// </summary>
        [JsonPropertyName("type")]
        public string Type { get; }

        /// <summary>
        /// Returns the unique message identifier used for deduplication or
        /// request/response correlation.
        /// </summary>
        [JsonPropertyName("messageid")]
        public string MessageId { get; }

        /// <summary>
        /// Returns the identifier of the application this message belongs to,
        /// if applicable.
        /// </summary>
        [JsonPropertyName("applicationid")]
        public string ApplicationId { get; }

        /// <summary>
        /// Returns the socket endpoint identifier this message originates from
        /// or is targeted to.
        /// </summary>
        [JsonPropertyName("socketid")]
        public string SocketId { get; }

        /// <summary>
        /// Returns the connection identifier assigned by the socket manager
        /// during registration.
        /// </summary>
        [JsonPropertyName("connectionid")]
        public string ConnectionId { get; }

        /// <summary>
        /// Gets the optional sender identifier associated with this message.
        /// </summary>
        [JsonPropertyName("sender")]
        public string Sender { get; }

        /// <summary>
        /// Returns the optional list of target identifiers associated with this message.
        /// The collection is immutable and never <c>null</c>.
        /// </summary>
        public IEnumerable<string> Targets { get; }

        /// <summary>
        /// Returns the UTC timestamp indicating when the message instance was created.
        /// </summary>
        public DateTime Timestamp { get; }

        /// <summary>
        /// Gets the metadata dictionary containing arbitrary key/value pairs.
        /// The dictionary is immutable and never <c>null</c>.
        /// </summary>
        public IDictionary<string, string> Meta { get; }

        /// <summary>
        /// Initializes a new instance of the <see cref="Message"/> class.
        /// All parameters except <paramref name="type"/> may be omitted.
        /// </summary>
        /// <param name="type">
        /// The application-defined message type. Must not be <c>null</c>.
        /// </param>
        /// <param name="messageId">
        /// The unique message identifier. If <c>null</c>, a new identifier is generated.
        /// </param>
        /// <param name="applicationId">
        /// The application identifier this message belongs to, if applicable.
        /// </param>
        /// <param name="socketId">
        /// The socket endpoint identifier this message originates from or targets.
        /// </param>
        /// <param name="connectionId">
        /// The connection identifier assigned by the socket manager.
        /// </param>
        /// <param name="sender">
        /// Optional sender identifier.
        /// </param>
        /// <param name="targets">
        /// Optional list of target identifiers. If <c>null</c>, an empty collection is used.
        /// </param>
        /// <param name="timestamp">
        /// The UTC timestamp of message creation. If <c>null</c>, the current UTC time is used.
        /// </param>
        /// <param name="meta">
        /// Optional metadata dictionary. If <c>null</c>, an empty dictionary is used.
        /// </param>
        /// <exception cref="ArgumentNullException">
        /// Thrown when <paramref name="type"/> is <c>null</c>.
        /// </exception>
        public Message(
            string type,
            string messageId = null,
            string applicationId = null,
            string socketId = null,
            string connectionId = null,
            string sender = null,
            IEnumerable<string> targets = null,
            DateTime? timestamp = null,
            IDictionary<string, string> meta = null)
        {
            Type = type ?? throw new ArgumentNullException(nameof(type));
            MessageId = messageId ?? Guid.NewGuid().ToString("N");

            ApplicationId = applicationId;
            SocketId = socketId;
            ConnectionId = connectionId;
            Sender = sender;

            Targets = targets != null
                ? targets.ToArray()
                : Array.Empty<string>();

            Timestamp = timestamp ?? DateTime.UtcNow;

            Meta = meta != null
                ? new Dictionary<string, string>(meta)
                : new Dictionary<string, string>();
        }

        /// <summary>
        /// Creates a new <see cref="Message"/> instance with the same values as the
        /// current instance, but with the specified metadata key/value pair added
        /// or replaced.
        /// </summary>
        /// <param name="key">The metadata key to add or update.</param>
        /// <param name="value">The metadata value to assign.</param>
        /// <returns>
        /// A new <see cref="Message"/> instance containing the updated metadata.
        /// </returns>
        /// <exception cref="ArgumentNullException">
        /// Thrown when <paramref name="key"/> is <c>null</c>.
        /// </exception>
        public Message WithMeta(string key, string value)
        {
            if (key == null)
            {
                throw new ArgumentNullException(nameof(key));
            }

            var newMeta = new Dictionary<string, string>(Meta)
            {
                [key] = value
            };

            return new Message(
                Type,
                MessageId,
                ApplicationId,
                SocketId,
                ConnectionId,
                Sender,
                Targets,
                Timestamp,
                newMeta
            );
        }
    }
}