using System;

namespace WebExpress.WebApp.WebMessageQueue
{
    /// <summary>
    /// Wire-format message types used to distribute progress task updates
    /// over the existing MessageQueue WebSocket infrastructure. Replaces the
    /// REST polling against
    /// <c>WebExpress.WebApp.WWW.Api.V1.ProgressTask</c>.
    /// </summary>
    public static class ProgressTaskMessageTypes
    {
        /// <summary>
        /// Common prefix shared by every progress task message type.
        /// </summary>
        public const string Prefix = "webexpress.webapp.progresstask.";

        /// <summary>
        /// Server-to-client: a state/progress/message update for a single
        /// task. The same type is used for the initial snapshot, every
        /// progress tick and the final finish event - the receiver
        /// distinguishes via the <c>state</c> field.
        /// </summary>
        public const string Update = Prefix + "update";

        /// <summary>
        /// Determines whether the specified message type belongs to the
        /// progress task family.
        /// </summary>
        public static bool IsProgressTask(string messageType)
        {
            return !string.IsNullOrEmpty(messageType)
                && messageType.StartsWith(Prefix, StringComparison.Ordinal);
        }
    }
}
