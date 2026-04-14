using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebStatusPage;

namespace WebExpress.WebApp.WebStatusPage
{
    /// <summary>
    /// Represents the HTTP 401 Unauthorized status page for the web application.
    /// Displayed when a request requires authentication that has not been provided or is invalid.
    /// </summary>
    [Title("webexpress.webapp:status.401.title")]
    [Description("webexpress.webapp:status.401.description")]
    [StatusResponse<ResponseUnauthorized>()]
    public sealed class PageStatusWebAppUnauthorized : PageStatusWebApp
    {
        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="statusPageContext">The context of the status page.</param>
        private PageStatusWebAppUnauthorized(IStatusPageContext statusPageContext)
            : base(statusPageContext)
        {
        }
    }
}
