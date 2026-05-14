using System;

namespace WebExpress.WebApp.WebMessageQueue
{
    /// <summary>
    /// Wire-format message types used to distribute popup notifications over
    /// the existing MessageQueue WebSocket infrastructure. The constants are
    /// shared between server and client and replace the previous REST polling
    /// based delivery of <see cref="WWW.Api._1.PopupNotification"/>.
    /// </summary>
    public static class PopupNotificationMessageTypes
    {
        /// <summary>
        /// Common prefix shared by every popup notification message type.
        /// </summary>
        public const string Prefix = "webexpress.webapp.popup.";

        /// <summary>
        /// Server-to-client: a new (or still-active, on replay) notification
        /// that the client should display until dismissed or expired.
        /// </summary>
        public const string Show = Prefix + "show";

        /// <summary>
        /// Client-to-server: the user dismissed a notification on the
        /// client side. The server removes it from the
        /// <c>NotificationManager</c> so it is not replayed on reconnect.
        /// </summary>
        public const string Dismiss = Prefix + "dismiss";

        /// <summary>
        /// Determines whether the specified message type belongs to the
        /// popup family and should therefore be routed to the dedicated
        /// handler.
        /// </summary>
        /// <param name="messageType">
        /// The raw message type as transmitted by the client. May be
        /// <c>null</c>.
        /// </param>
        /// <returns>
        /// <c>true</c> if the type is a popup message; otherwise
        /// <c>false</c>.
        /// </returns>
        public static bool IsPopup(string messageType)
        {
            return !string.IsNullOrEmpty(messageType)
                && messageType.StartsWith(Prefix, StringComparison.Ordinal);
        }
    }
}
