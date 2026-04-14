using System.Collections.Generic;
using WebExpress.WebCore.WebIdentity;
using WebExpress.WebCore.WebMessage;

namespace WebExpress.WebApp.WebIdentity
{
    /// <summary>
    /// Provides an abstract base class for identity providers that supply identities and groups
    /// and support authentication via HTTP authorization headers.
    /// </summary>
    public abstract class IdentityProvider
    {
        /// <summary>
        /// Returns all identities managed by this provider.
        /// </summary>
        /// <returns>An enumerable of identities.</returns>
        public abstract IEnumerable<IIdentity> GetIdentities();

        /// <summary>
        /// Returns all identity groups managed by this provider.
        /// </summary>
        /// <returns>An enumerable of identity groups.</returns>
        public abstract IEnumerable<IIdentityGroup> GetGroups();

        /// <summary>
        /// Validates basic authentication credentials and returns the corresponding identity.
        /// </summary>
        /// <param name="username">The provided username.</param>
        /// <param name="password">The provided password.</param>
        /// <returns>The authenticated identity, or null if the credentials are invalid.</returns>
        protected abstract IIdentity ValidateBasicCredentials(string username, string password);

        /// <summary>
        /// Validates a bearer token and returns the corresponding identity.
        /// </summary>
        /// <param name="token">The provided bearer token.</param>
        /// <returns>The authenticated identity, or null if the token is invalid.</returns>
        protected abstract IIdentity ValidateToken(string token);

        /// <summary>
        /// Authenticates the specified request by inspecting the HTTP Authorization header.
        /// Supports both Basic and Bearer (token) authentication schemes.
        /// </summary>
        /// <param name="request">The request to authenticate. Cannot be null.</param>
        /// <returns>
        /// The identity of the authenticated user if authentication succeeds; otherwise, null.
        /// </returns>
        public IIdentity Authenticate(IRequest request)
        {
            if (request is null)
            {
                return null;
            }

            var authorization = request.Header?.Authorization;

            if (authorization is null || string.IsNullOrWhiteSpace(authorization.Type))
            {
                return null;
            }

            var authType = authorization.Type.ToLowerInvariant();

            if (authType == "basic")
            {
                return ValidateBasicCredentials(authorization.Identification, authorization.Password);
            }

            if (authType == "bearer" || authType == "token")
            {
                return ValidateToken(authorization.Identification);
            }

            return null;
        }
    }
}
