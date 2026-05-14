using System;
using WebExpress.WebCore.WebApplication;

namespace WebExpress.WebApp.WebMessageQueue
{
    /// <summary>
    /// Addressing rule that selects every client session associated with a
    /// specific <see cref="IApplicationContext"/>. Used for broadcasting
    /// global popup notifications to all connected clients of an application.
    /// </summary>
    public sealed class AddressApplication : IAddress
    {
        private readonly string _applicationId;

        /// <summary>
        /// Initializes a new instance for the specified application context.
        /// </summary>
        /// <param name="applicationContext">
        /// The application whose connected clients should receive the
        /// message. <c>null</c> matches every session.
        /// </param>
        public AddressApplication(IApplicationContext applicationContext)
        {
            _applicationId = applicationContext?.ApplicationId;
        }

        /// <summary>
        /// Determines whether the specified client session belongs to the
        /// configured application.
        /// </summary>
        /// <param name="session">The client session to evaluate.</param>
        /// <returns>
        /// <c>true</c> if the session belongs to the configured application
        /// (or if no application was configured); otherwise <c>false</c>.
        /// </returns>
        public bool Matches(IClientSession session)
        {
            if (session == null)
            {
                return false;
            }
            if (string.IsNullOrEmpty(_applicationId))
            {
                return true;
            }
            return string.Equals
            (
                session.ApplicationContext?.ApplicationId,
                _applicationId,
                StringComparison.OrdinalIgnoreCase
            );
        }
    }
}
