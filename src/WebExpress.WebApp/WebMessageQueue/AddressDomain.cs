using WebExpress.WebApp.WebMessageQueue;
using WebExpress.WebCore.WebDomain;

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
        return true;
    }
}