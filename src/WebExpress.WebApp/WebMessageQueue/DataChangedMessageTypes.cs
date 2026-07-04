namespace WebExpress.WebApp.WebMessageQueue
{
    /// <summary>
    /// The well known message type identifiers of the data change family.
    /// A data change message informs connected clients that server side data
    /// of a logical domain was created, updated or deleted, so a scope
    /// ViewState can re-query the resources that render that data. The
    /// subscribe type is the inbound counterpart with which a client extends
    /// its session's domain set at runtime, so a scope receives change
    /// messages for the domains its services declare without the page having
    /// to know them at render time.
    /// </summary>
    public static class DataChangedMessageTypes
    {
        /// <summary>
        /// The shared prefix of every data change message type.
        /// </summary>
        public const string Prefix = "webexpress.webapp.data.";

        /// <summary>
        /// Outbound: server side data of a domain changed. The message carries
        /// the domain name, the operation and optionally the item id.
        /// </summary>
        public const string Changed = "webexpress.webapp.data.changed";

        /// <summary>
        /// Inbound: a client subscribes its connection to a set of domains, so
        /// change messages for those domains reach it.
        /// </summary>
        public const string Subscribe = "webexpress.webapp.data.subscribe";

        /// <summary>
        /// Determines whether the specified message type belongs to the data
        /// change family.
        /// </summary>
        /// <param name="messageType">The message type to check.</param>
        /// <returns>
        /// <c>true</c> if the type carries the data change prefix; otherwise
        /// <c>false</c>.
        /// </returns>
        public static bool IsDataChange(string messageType)
        {
            return messageType?.StartsWith(Prefix) ?? false;
        }
    }
}
