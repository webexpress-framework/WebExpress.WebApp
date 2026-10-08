using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebStatusPage;

namespace WebExpress.WebApp.WebStatusPage
{
    /// <summary>
    /// The WebApp status page shown for HTTP 404 (Not Found).
    /// </summary>
    [Title("webexpress.webapp:status.404.title")]
    [Description("webexpress.webapp:status.404.description")]
    [StatusResponse<ResponseNotFound>()]
    public sealed class PageStatusWebAppNotFound : PageStatusWebApp
    {
        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="statusPageContext">The context of the status page.</param>
        private PageStatusWebAppNotFound(IStatusPageContext statusPageContext)
            : base(statusPageContext)
        {
        }
    }
}
