using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebStatusPage;

namespace WebExpress.WebApp.WebStatusPage
{
    /// <summary>
    /// Represents a web application page status for HTTP 400 Bad Request responses.
    /// </summary>
    /// <remarks>
    /// This class is used to handle and display information related to HTTP 400 Bad Request errors
    /// within a web application. It provides localized status messages and titles for the error page.
    /// </remarks>
    [Title("webexpress.webapp:status.400.title")]
    [Description("webexpress.webapp:status.400.description")]
    [StatusResponse<ResponseBadRequest>()]
    public sealed class PageStatusWebAppBadRequest : PageStatusWebApp
    {
        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="statusPageContext">The context of the status page.</param>
        private PageStatusWebAppBadRequest(IStatusPageContext statusPageContext)
            : base(statusPageContext)
        {
        }
    }
}
