using System.Collections.Generic;
using WebExpress.WebApp.WebPage;
using WebExpress.WebApp.WebScope;
using WebExpress.WebCore;
using WebExpress.WebCore.WebIdentity;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebPage;
using WebExpress.WebCore.WebUri;
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
        /// Gets or sets the REST session endpoint URI used for HTTP requests.
        /// </summary>
        public IUri RestUri { get; set; }

        /// <summary>
        /// Returns all identities provided by this source.
        /// </summary>
        public abstract IEnumerable<IIdentity> GetIdentities();

        /// <summary>
        /// Returns all groups provided by this source.
        /// </summary>
        public abstract IEnumerable<IIdentityGroup> GetGroups();

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
        public virtual IResponse CreateAuthenticationPrompt(IRequest request, IPageContext initiator, IIdentity identity)
        {
            return CreateAuthenticationPrompt(request, initiator, identity, RestUri);
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
        /// <param name="sessionUri">The REST session endpoint URI.</param>
        /// <returns>
        /// An object that represents the response to the login dialog, including authentication results and any
        /// relevant status information.
        /// </returns>
        public virtual IResponse CreateAuthenticationPrompt(IRequest request, IPageContext initiator, IIdentity identity, IUri sessionUri)
        {
            var loginPage = new PageLogin();
            var pageContext = new PageContext(initiator, scopes: [typeof(IScopeLogin)]);
            var renderContext = new RenderControlContext(loginPage, pageContext, request);
            var visualTree = new VisualTreeWebAppLogin(WebEx.ComponentHub, pageContext) { LoginUri = sessionUri };
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

        /// <summary>
        /// Creates a forbidden response page for the specified request when the authenticated
        /// user lacks the required permissions to access the requested resource.
        /// </summary>
        /// <param name="request">
        /// The request for which access was denied. Cannot be null.
        /// </param>
        /// <param name="initiator">
        /// The endpoint that the user attempted to access. Used to determine the origin and
        /// context of the authorization failure.
        /// </param>
        /// <param name="identity">
        /// The authenticated identity that lacks sufficient permissions. Cannot be null.
        /// </param>
        /// <returns>
        /// A response representing the forbidden page if this provider can handle the forbidden
        /// scenario; otherwise, <c>null</c>.
        /// </returns>
        public IResponse CreateForbiddenPage(IRequest request, IPageContext initiator, IIdentity identity)
        {
            var loginPage = new PageForbidden();
            var pageContext = new PageContext(initiator, scopes: [typeof(IScopeLogin)]);
            var renderContext = new RenderControlContext(loginPage, pageContext, request);
            var visualTree = new VisualTreeWebApp(WebEx.ComponentHub, pageContext);
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
