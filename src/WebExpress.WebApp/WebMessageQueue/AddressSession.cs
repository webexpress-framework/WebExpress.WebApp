using System;
using WebExpress.WebCore.WebSession.Model;

namespace WebExpress.WebApp.WebMessageQueue
{
    /// <summary>
    /// Addressing rule that selects every client connection belonging to a
    /// specific <see cref="Session"/>. Used to target session-scoped popup
    /// notifications at the user that triggered them (and only at that user's
    /// other open tabs/windows).
    /// </summary>
    public sealed class AddressSession : IAddress
    {
        private readonly Guid _sessionId;

        /// <summary>
        /// Initializes a new instance for the specified session.
        /// </summary>
        /// <param name="session">
        /// The session whose connections should receive the message.
        /// </param>
        public AddressSession(Session session)
        {
            _sessionId = session?.Id ?? Guid.Empty;
        }

        /// <summary>
        /// Initializes a new instance for the specified session id.
        /// </summary>
        /// <param name="sessionId">
        /// The id of the session whose connections should receive the
        /// message.
        /// </param>
        public AddressSession(Guid sessionId)
        {
            _sessionId = sessionId;
        }

        /// <summary>
        /// Determines whether the specified client session matches the
        /// configured target session.
        /// </summary>
        /// <param name="session">The candidate client session.</param>
        /// <returns>
        /// <c>true</c> if the session ids match; otherwise <c>false</c>.
        /// </returns>
        public bool Matches(IClientSession session)
        {
            if (session?.Session == null)
            {
                return false;
            }
            return _sessionId != Guid.Empty
                && session.Session.Id == _sessionId;
        }
    }
}
