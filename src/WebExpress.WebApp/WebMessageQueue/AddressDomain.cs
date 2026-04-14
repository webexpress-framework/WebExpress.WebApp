using System;
using System.Linq;
using WebExpress.WebApp.WebMessageQueue;
using WebExpress.WebCore.WebDomain;

/// <summary>
/// Represents an address that is associated with a specific domain.
/// </summary>
public sealed class AddressDomain : IAddress
{
    /// <summary>
    /// Gets the domain associated with the current context.
    /// </summary>
    public string Domain { get; }

    /// <summary>
    /// Initializes a new instance of the class with the specified domain.
    /// </summary>
    /// <param name="domain">
    /// The domain to associate with this AddressDomain instance. Cannot be null.
    /// </param>
    public AddressDomain(IDomain domain)
    {
        Domain = domain.GetType().FullName.ToLower();
    }

    /// <summary>
    /// Determines whether the specified client session includes the domain associated 
    /// with this instance.
    /// </summary>
    /// <param name="session">
    /// The client session to check for the presence of the domain. Cannot be null.
    /// </param>
    /// <returns>
    /// True if the session contains the domain; otherwise, false.
    /// </returns>
    public bool Matches(IClientSession session)
    {
        return session?.Domains.Contains(Domain) ?? false;
    }
}

/// <summary>
/// Represents an addressing rule that selects all client sessions
/// associated with a specific logical domain. Domains describe
/// application-defined areas such as workspaces, modules or
/// functional segments, and are stored as metadata on each session.
/// </summary>
public sealed class AddressDomain<TDomain> : IAddress
    where TDomain : IDomain
{
    /// <summary>
    /// Initializes a new instance of the class
    /// using the specified domain identifier.
    /// </summary>
    public AddressDomain()
    {
    }

    /// <summary>
    /// Determines whether the specified client session matches the domain rule.
    /// A session matches when its metadata contains a key named "domain"
    /// whose value equals the configured domain identifier.
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
        var domain = typeof(TDomain).Name.ToLower();

        return session?.Domains.Contains(domain) ?? false;
    }
}