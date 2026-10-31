using System;
using System.Collections.Generic;
using System.Text.Json;

namespace WebExpress.WebApp.WebMessageQueue
{
    /// <summary>
    /// A message another instance of the cluster already serialized. It is passed to the local
    /// clients exactly as it was rendered there, since the concrete message type - a plugin's
    /// own, perhaps - need not exist on this instance.
    /// </summary>
    internal sealed class ForwardedMessage : IMessage
    {
        /// <summary>
        /// Gets the message as it is sent to the clients.
        /// </summary>
        public string Json { get; }

        /// <summary>
        /// Gets the message type.
        /// </summary>
        public string Type { get; }

        /// <summary>
        /// Gets the message id.
        /// </summary>
        public string MessageId { get; }

        /// <summary>
        /// Gets the application id.
        /// </summary>
        public string ApplicationId { get; }

        /// <summary>
        /// Gets the socket id.
        /// </summary>
        public string SocketId { get; }

        /// <summary>
        /// Gets the connection id.
        /// </summary>
        public string ConnectionId { get; }

        /// <summary>
        /// Gets the sender.
        /// </summary>
        public string Sender { get; }

        /// <summary>
        /// Gets the time the message was created.
        /// </summary>
        public DateTime Timestamp { get; }

        /// <summary>
        /// Gets the metadata.
        /// </summary>
        public IDictionary<string, string> Meta { get; } = new Dictionary<string, string>();

        /// <summary>
        /// Initializes a new instance of the class. The envelope fields are read back from the
        /// json for clients that dispatch on them before sending.
        /// </summary>
        /// <param name="json">The serialized message.</param>
        public ForwardedMessage(string json)
        {
            Json = json;

            try
            {
                using var document = JsonDocument.Parse(json);
                var root = document.RootElement;

                Type = Read(root, "type");
                MessageId = Read(root, "messageId");
                ApplicationId = Read(root, "applicationId");
                SocketId = Read(root, "socketId");
                ConnectionId = Read(root, "connectionId");
                Sender = Read(root, "sender");
                Timestamp = root.TryGetProperty("timestamp", out var timestamp) && timestamp.TryGetDateTime(out var value)
                    ? value
                    : DateTime.UtcNow;
            }
            catch (JsonException)
            {
                Timestamp = DateTime.UtcNow;
            }
        }

        /// <summary>
        /// Reads a string property.
        /// </summary>
        /// <param name="root">The json object.</param>
        /// <param name="name">The property name.</param>
        /// <returns>The value, or null when absent or not a string.</returns>
        private static string Read(JsonElement root, string name)
        {
            return root.ValueKind == JsonValueKind.Object
                && root.TryGetProperty(name, out var element)
                && element.ValueKind == JsonValueKind.String
                ? element.GetString()
                : null;
        }
    }
}
