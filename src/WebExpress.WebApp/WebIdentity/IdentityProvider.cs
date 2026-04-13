using System.Collections.Generic;
using WebExpress.WebApp.WebPage;
using WebExpress.WebApp.WebScope;
using WebExpress.WebCore;
using WebExpress.WebCore.WebEndpoint;
using WebExpress.WebCore.WebIdentity;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebPage;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebIdentity
{
    /// <summary>
    /// Represents an external identity provider that supplies identities and groups
    /// to the WebExpress identity system.
    /// </summary>
    public abstract class IdentityProvider : IIdentityProvider
    {
        /// <summary>
        /// Returns all identities provided by this source.
        /// </summary>
        public abstract IEnumerable<IIdentity> GetIdentities();

        /// <summary>
        /// Returns all groups provided by this source.
        /// </summary>
        public abstract IEnumerable<IIdentityGroup> GetGroups();

        /// <summary>
        /// Validates basic authentication credentials.
        /// </summary>
        /// <param name="username">The provided username.</param>
        /// <param name="password">The provided password.</param>
        /// <returns>The authenticated identity, or null if invalid.</returns>
        protected abstract IIdentity ValidateBasicCredentials(string username, string password);

        /// <summary>
        /// Validates a token for authentication.
        /// </summary>
        /// <param name="token">The provided token.</param>
        /// <returns>The authenticated identity, or null if invalid.</returns>
        protected abstract IIdentity ValidateToken(string token);

        /// <summary>
        /// Authenticates the specified request and returns the associated identity.
        /// </summary>
        /// <param name="request">
        /// The request to authenticate. Cannot be null.
        /// </param>
        /// <returns>
        /// An identity representing the authenticated user if authentication is successful; otherwise, null.
        /// </returns>
        public virtual IIdentity Authenticate(IRequest request)
        {
            if (request is null)
            {
                return null;
            }

            // extract the authorization header from the request
            var authHeader = request.Header.Authorization;

            if (authHeader is null)
            {
                return null;
            }

            if (authHeader.Type.Equals("basic", System.StringComparison.InvariantCultureIgnoreCase))
            {
                // perform basic authentication
                return ValidateBasicCredentials(authHeader.Identification, authHeader.Password);
            }
            else if (authHeader.Type.Equals("bearer", System.StringComparison.InvariantCultureIgnoreCase))
            {
                // perform token authentication
                return ValidateToken(authHeader.Identification);
            }
            else if (authHeader.Type.Equals("token", System.StringComparison.InvariantCultureIgnoreCase))
            {
                // perform token authentication
                return ValidateToken(authHeader.Identification);
            }

            return null;
        }

        /// <summary>
        /// Displays a login dialog using the specified request and identity information.
        /// </summary>
        /// <param name="request">
        /// The request containing parameters and context for the login operation. Cannot be null.
        /// </param>
        /// <param name="initiator">
        /// The endpoint that triggered the authentication process. Used to determine the origin and
        /// context of the authentication requirement.
        /// </param>
        /// <param name="identity">
        /// The identity information to be used for authentication. Cannot be null.
        /// </param>
        /// <returns>
        /// An object that represents the response to the login dialog, including authentication results and any
        /// relevant status information.
        /// </returns>
        public virtual IResponse CreateAuthenticationPrompt(IRequest request, IEndpointContext initiator, IIdentity identity)
        {
            var loginPage = new PageLogin();
            var pageContext = new PageContext(initiator, scopes: [typeof(IScopeLogin)]);
            var renderContext = new RenderControlContext(loginPage, pageContext, request);
            var visualTree = new VisualTreeWebAppLogin(WebEx.ComponentHub, pageContext);
            var visualTreeContext = new VisualTreeContext(renderContext);
            loginPage.Process(renderContext, visualTree);

            var content = visualTree.Render(visualTreeContext)?.ToString();

            var response = new ResponseOK
            {
                Content = content
            };
            response.Header.ContentLength = content.Length;
            response.Header.ContentType = "text/html; charset=utf-8";

            return response;
        }
    }
}
