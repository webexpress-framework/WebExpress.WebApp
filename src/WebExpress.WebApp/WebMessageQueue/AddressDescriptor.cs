using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebMessageQueue
{
    /// <summary>
    /// An address reduced to plain data, so it can travel to the other instances of a cluster
    /// and select the same recipients among the clients connected there. An address is a
    /// predicate over a live client session, which cannot be sent; its criteria can.
    /// </summary>
    /// <remarks>
    /// Every criterion that is set must hold; one left unset does not restrict. An address that
    /// sets none reaches every client - which is what an application-wide address without an
    /// application means.
    /// </remarks>
    public sealed class AddressDescriptor : IAddress
    {
        /// <summary>
        /// Gets or sets the application the client must be connected to.
        /// </summary>
        [JsonPropertyName("application")]
        public string ApplicationId { get; set; }

        /// <summary>
        /// Gets or sets the session the client must belong to.
        /// </summary>
        [JsonPropertyName("session")]
        public Guid? SessionId { get; set; }

        /// <summary>
        /// Gets or sets the domains of which the client must observe at least one.
        /// </summary>
        [JsonPropertyName("domains")]
        public IReadOnlyList<string> Domains { get; set; }

        /// <summary>
        /// Gets or sets a connection that must not receive the message, typically its sender.
        /// </summary>
        [JsonPropertyName("exclude")]
        public Guid? ExcludeConnectionId { get; set; }

        /// <summary>
        /// Determines whether a client meets every criterion that is set.
        /// </summary>
        /// <param name="session">The client session.</param>
        /// <returns>True when the client receives the message.</returns>
        public bool Matches(IClientSession session)
        {
            if (session is null)
            {
                return false;
            }

            if (ExcludeConnectionId is Guid excluded && session.ConnectionId == excluded)
            {
                return false;
            }

            if (ApplicationId is not null
                && !string.Equals(session.ApplicationContext?.ApplicationId, ApplicationId, StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            if (SessionId is Guid sessionId && session.Session?.Id != sessionId)
            {
                return false;
            }

            if (Domains is { Count: > 0 } domains
                && !(session.Domains?.Any(x => domains.Contains(x, StringComparer.OrdinalIgnoreCase)) ?? false))
            {
                return false;
            }

            return true;
        }

        /// <summary>
        /// Returns the descriptor of this address, which is the address itself.
        /// </summary>
        /// <returns>This instance.</returns>
        public AddressDescriptor Describe() => this;
    }
}
