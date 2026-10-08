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

        /// <summary>
        /// Describes the address as plain data, so the other instances of a cluster can select
        /// the same recipients among their own clients. An address that cannot be described -
        /// one deciding on state only this instance has - reaches the local clients only.
        /// </summary>
        /// <returns>The description, or null when the address cannot leave this instance.</returns>
        AddressDescriptor Describe() => null;
    }
}
