using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebStatusPage;

namespace WebExpress.WebApp.WebStatusPage
{
    /// <summary>
    /// Represents the HTTP 403 Forbidden status page for the web application.
    /// Displayed when an authenticated user attempts to access a resource they are not permitted to access.
    /// </summary>
    [Title("webexpress.webapp:status.403.title")]
    [Description("webexpress.webapp:status.403.description")]
    [StatusResponse<ResponseForbidden>()]
    public sealed class PageStatusWebAppForbidden : PageStatusWebApp
    {
        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="statusPageContext">The context of the status page.</param>
        private PageStatusWebAppForbidden(IStatusPageContext statusPageContext)
            : base(statusPageContext)
        {
        }
    }
}
