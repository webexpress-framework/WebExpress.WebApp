using System.Linq;
using WebExpress.WebCore.WebDomain;

namespace WebExpress.WebApp.WebMessageQueue
{
    /// <summary>
    /// Represents an addressing rule that selects all client sessions
    /// associated with a specific logical domain. Domains describe
    /// application-defined areas such as workspaces, modules or functional
    /// segments, and are stored as metadata on each session. The wire name of
    /// a domain is derived once through
    /// <see cref="DataChangedNotifier.DomainName"/>, so the addressing, the
    /// session metadata and the change messages agree on one identifier.
    /// </summary>
    public sealed class AddressDomain : IAddress
    {
        /// <summary>
        /// Gets the wire name of the domain this address selects.
        /// </summary>
        public string Domain { get; }

        /// <summary>
        /// Initializes a new instance of the class from a domain instance.
        /// </summary>
        /// <param name="domain">
        /// The domain to associate with this instance. Cannot be null.
        /// </param>
        public AddressDomain(IDomain domain)
            : this(DataChangedNotifier.DomainName(domain?.GetType()))
        {
        }

        /// <summary>
        /// Initializes a new instance of the class from an already derived
        /// wire name, for callers such as <see cref="DataChangedNotifier"/>
        /// that address a domain by its type rather than an instance.
        /// </summary>
        /// <param name="domain">The wire name of the domain.</param>
        public AddressDomain(string domain)
        {
            Domain = domain;
        }

        /// <summary>
        /// Determines whether the specified client session includes the domain
        /// associated with this instance.
        /// </summary>
        /// <param name="session">
        /// The client session to check for the presence of the domain.
        /// </param>
        /// <returns>
        /// True if the session contains the domain; otherwise, false.
        /// </returns>
        public bool Matches(IClientSession session)
        {
            if (Domain == null)
            {
                return false;
            }

            return session?.Domains?.Contains(Domain, System.StringComparer.OrdinalIgnoreCase) ?? false;
        }
    }

    /// <summary>
    /// The type-safe form of <see cref="AddressDomain"/>, for callers that
    /// know the domain at compile time.
    /// </summary>
    /// <typeparam name="TDomain">The domain type the address selects.</typeparam>
    public sealed class AddressDomain<TDomain> : IAddress
        where TDomain : IDomain
    {
        private readonly AddressDomain _address = new(DataChangedNotifier.DomainName(typeof(TDomain)));

        /// <summary>
        /// Determines whether the specified client session matches the domain rule.
        /// </summary>
        /// <param name="session">
        /// The client session to evaluate.
        /// </param>
        /// <returns>
        /// <c>true</c> if the session belongs to the specified domain;
        /// otherwise <c>false</c>.
        /// </returns>
        public bool Matches(IClientSession session)
        {
            return _address.Matches(session);
        }
    }
}
