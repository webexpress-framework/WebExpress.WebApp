using System;

namespace WebExpress.WebApp.WebMessageQueue
{
    /// <summary>
    /// Wire-format message types used by the chat control to talk to the
    /// server over the existing MessageQueue WebSocket. The same prefix
    /// covers both group chats and 1:1 direct conversations — the
    /// <c>channelId</c> on every payload selects the target conversation.
    /// </summary>
    public static class ChatMessageTypes
    {
        /// <summary>
        /// Common prefix shared by every chat message type.
        /// </summary>
        public const string Prefix = "webexpress.webapp.chat.";

        /// <summary>
        /// Bidirectional: a single chat message in a channel. Clients send
        /// it without a server <c>messageId</c>; the server enriches it,
        /// persists it in the channel ring buffer and broadcasts the
        /// authoritative copy back to every participant (including the
        /// sender, so timestamps and ids stay consistent).
        /// </summary>
        public const string Message = Prefix + "message";

        /// <summary>
        /// Client-to-server: request the recent history for a channel. The
        /// server replays every buffered message as an individual
        /// <see cref="Message"/> back to the requesting socket so the
        /// client only needs a single code path for fresh and replayed
        /// messages.
        /// </summary>
        public const string HistoryRequest = Prefix + "history.request";

        /// <summary>
        /// Determines whether the specified message type belongs to the
        /// chat family and should therefore be routed to
        /// <see cref="ChatMessageHandler"/>.
        /// </summary>
        public static bool IsChat(string messageType)
        {
            return !string.IsNullOrEmpty(messageType)
                && messageType.StartsWith(Prefix, StringComparison.Ordinal);
        }
    }
}
