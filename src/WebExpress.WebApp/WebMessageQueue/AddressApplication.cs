using WebExpress.WebCore.WebApplication;

namespace WebExpress.WebApp.WebMessageQueue
{
    /// <summary>
    /// Addressing rule that selects every client session of a signed-in caller associated
    /// with a specific <see cref="IApplicationContext"/>. Used for broadcasting global popup
    /// notifications and the progress of tasks to the users of an application.
    /// </summary>
    /// <remarks>
    /// The message queue admits visitors who are not signed in, so that pages which work
    /// without signing in stay live. A broadcast has no audience of its own, though - a global
    /// notification or the message of a task is written for the users of the application - so
    /// it never reaches a connection without an identity.
    /// </remarks>
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
        /// Determines whether the specified client session is signed in and belongs to the
        /// configured application.
        /// </summary>
        /// <param name="session">The client session to evaluate.</param>
        /// <returns>
        /// <c>true</c> if the session is signed in and belongs to the configured application
        /// (or if no application was configured); otherwise <c>false</c>.
        /// </returns>
        public bool Matches(IClientSession session)
        {
            return Describe().Matches(session);
        }

        /// <summary>
        /// Describes the address for the other instances of a cluster.
        /// </summary>
        /// <returns>The description; without an application it reaches every signed-in client.</returns>
        public AddressDescriptor Describe()
        {
            return new AddressDescriptor { ApplicationId = _applicationId, SignedInOnly = true };
        }
    }
}
