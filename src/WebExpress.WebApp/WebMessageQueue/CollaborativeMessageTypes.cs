namespace WebExpress.WebApp.WebMessageQueue
{
    /// <summary>
    /// Defines the message type identifiers used by the collaborative control
    /// (presence, cursor and input synchronization). The same string constants
    /// are used by the client-side <c>CollaborativeCtrl</c> when emitting and
    /// receiving messages through the shared <see cref="IMessageQueueSocket"/>.
    /// </summary>
    public static class CollaborativeMessageTypes
    {
        /// <summary>
        /// Common prefix shared by every collaborative message type. Used by
        /// <see cref="MessageQueueSocket"/> to recognize collaborative traffic
        /// without enumerating every individual type.
        /// </summary>
        public const string Prefix = "webexpress.webapp.collaborative.";

        /// <summary>
        /// Presence update covering join, periodic heartbeat and leave events.
        /// The concrete action is carried in the payload's <c>status</c> field
        /// (<c>join</c>, <c>ping</c> or <c>leave</c>) to match the wire format
        /// emitted by the client side <c>CollaborativeCtrl</c>.
        /// </summary>
        public const string Presence = Prefix + "presence";

        /// <summary>
        /// A cursor position update originating from a remote user.
        /// </summary>
        public const string Cursor = Prefix + "cursor";

        /// <summary>
        /// An input value update originating from a remote user.
        /// </summary>
        public const string Input = Prefix + "input";

        /// <summary>
        /// A lightweight caret position update emitted whenever a remote user
        /// moves the text caret without changing the field value (arrow keys,
        /// mouse click into another position, focus change).
        /// </summary>
        public const string Caret = Prefix + "caret";

        /// <summary>
        /// Determines whether the specified message type belongs to the
        /// collaborative family and should therefore be routed to the
        /// dedicated handler.
        /// </summary>
        /// <param name="messageType">
        /// The raw message type as transmitted by the client. May be
        /// <c>null</c>.
        /// </param>
        /// <returns>
        /// <c>true</c> if the type is a collaborative message; otherwise
        /// <c>false</c>.
        /// </returns>
        public static bool IsCollaborative(string messageType)
        {
            return !string.IsNullOrEmpty(messageType)
                && messageType.StartsWith(Prefix, System.StringComparison.Ordinal);
        }
    }
}
