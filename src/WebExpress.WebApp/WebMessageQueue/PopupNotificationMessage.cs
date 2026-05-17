using System;
using System.Collections.Generic;
using WebExpress.WebUI.WebNotification;

namespace WebExpress.WebApp.WebMessageQueue
{
    /// <summary>
    /// Wire-format envelope used to deliver a popup notification from the
    /// server to all matching clients. The <see cref="Notification"/>
    /// property is serialized as a nested object so the client can read
    /// every field (<c>id</c>, <c>heading</c>, <c>message</c>,
    /// <c>durability</c>, <c>created</c>, …) directly from
    /// <c>payload.notification.*</c>.
    /// </summary>
    public sealed class PopupNotificationMessage : IMessage
    {
        /// <summary>
        /// Gets the application-defined message type. Always
        /// <see cref="PopupNotificationMessageTypes.Show"/> for this class.
        /// </summary>
        public string Type { get; }

        /// <summary>
        /// Gets the unique message identifier.
        /// </summary>
        public string MessageId { get; }

        /// <summary>
        /// Gets the application id this notification belongs to.
        /// </summary>
        public string ApplicationId { get; }

        /// <summary>
        /// Gets the socket endpoint identifier. Not used for popup messages.
        /// </summary>
        public string SocketId { get; }

        /// <summary>
        /// Gets the connection id assigned by the socket manager.
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
        /// Gets the (empty) metadata dictionary required by
        /// <see cref="IMessage"/>.
        /// </summary>
        public IDictionary<string, string> Meta { get; }

        /// <summary>
        /// Gets the notification carried by this envelope. Serialized as a
        /// nested <c>notification</c> object so the client can render it
        /// with the same shape as the legacy REST payload.
        /// </summary>
        public INotification Notification { get; }

        /// <summary>
        /// Initializes a new instance.
        /// </summary>
        /// <param name="notification">
        /// The notification to deliver. Cannot be <c>null</c>.
        /// </param>
        /// <param name="applicationId">
        /// The owning application id, if known.
        /// </param>
        public PopupNotificationMessage(INotification notification, string applicationId = null)
        {
            Notification = notification ?? throw new ArgumentNullException(nameof(notification));
            Type = PopupNotificationMessageTypes.Show;
            MessageId = Guid.NewGuid().ToString("N");
            ApplicationId = applicationId;
            Timestamp = DateTime.UtcNow;
            Meta = new Dictionary<string, string>();
        }
    }
}
