using System;

namespace WebExpress.WebApp.WebMessageQueue
{
    /// <summary>
    /// The outbound WebSocket message that announces a server side data change
    /// to the clients of a domain. It carries the domain name so a client can
    /// route the change to the ViewStates whose services declare that
    /// domain, the operation so a client can distinguish structural from value
    /// changes, and optionally the id of the changed item. The message body
    /// deliberately carries no data: the client re-queries through its
    /// declared services, so the REST endpoint stays the single source of the
    /// data and its authorization.
    /// </summary>
    public class DataChangedMessage : Message
    {
        /// <summary>
        /// Gets the wire name of the changed domain, which is the lower case
        /// full name of the domain type (see <see cref="AddressDomain"/>).
        /// </summary>
        public string Domain { get; }

        /// <summary>
        /// Gets the announced operation as its lower case wire value, one of
        /// "created", "updated" or "deleted".
        /// </summary>
        public string Operation { get; }

        /// <summary>
        /// Gets the id of the changed item, when the producer knows it. A
        /// client treats a missing id as "anything of this domain may have
        /// changed".
        /// </summary>
        public string ItemId { get; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="domain">The wire name of the changed domain.</param>
        /// <param name="operation">The announced operation.</param>
        /// <param name="itemId">The optional id of the changed item.</param>
        /// <exception cref="ArgumentNullException">
        /// Thrown when <paramref name="domain"/> is <c>null</c>.
        /// </exception>
        public DataChangedMessage(string domain, DataChangeOperation operation, string itemId = null)
            : base(DataChangedMessageTypes.Changed)
        {
            Domain = domain ?? throw new ArgumentNullException(nameof(domain));
            Operation = operation.ToString().ToLowerInvariant();
            ItemId = itemId;
        }
    }
}
