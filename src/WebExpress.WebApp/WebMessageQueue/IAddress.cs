namespace WebExpress.WebApp.WebMessageQueue
{
    /// <summary>
    /// Defines a contract for address representations that can be matched 
    /// against a client session.
    /// </summary>
    public interface IAddress
    {
        /// <summary>
        /// Determines whether the specified client session satisfies the matching criteria.
        /// </summary>
        /// <param name="session">
        /// The client session to evaluate against the matching criteria. Cannot be null.
        /// </param>
        /// <returns>
        /// True if the session matches the criteria; otherwise, false.
        /// </returns>
        bool Matches(IClientSession session);
    }
}
