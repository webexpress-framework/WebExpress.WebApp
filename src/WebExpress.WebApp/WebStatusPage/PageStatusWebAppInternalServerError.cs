using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebStatusPage;

namespace WebExpress.WebApp.WebStatusPage
{
    /// <summary>
    /// The status page 500.
    /// </summary>
    [Title("webexpress.webapp:status.500.title")]
    [Description("webexpress.webapp:status.500.description")]
    [StatusResponse<ResponseInternalServerError>()]
    public sealed class PageStatusWebAppInternalServerError : PageStatusWebApp
    {
        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="statusPageContext">The context of the status page.</param>
        /// <param name="statusMessage">The status message.</param>
        private PageStatusWebAppInternalServerError(IStatusPageContext statusPageContext, StatusMessage statusMessage)
            : base(statusPageContext, statusMessage)
        {
        }
    }
}
