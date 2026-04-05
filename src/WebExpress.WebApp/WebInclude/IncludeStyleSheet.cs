using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebInclude;

namespace WebExpress.WebApp.WebInclude
{
    /// <summary>
    /// Represents a collection of StyleSheet resources to be included in a web application.
    /// </summary>
    /// <remarks>
    /// This class is used to define and manage the inclusion of StyleSheet files required for the
    /// functionality of a web application.
    /// </remarks>
    [Asset("/assets/css/webexpress.webapp.css")]
    [Asset("/assets/css/webexpress.webapp.form.css")]
    [Asset("/assets/css/webexpress.webapp.popupnotification.css")]
    [Asset("/assets/css/webexpress.webapp.search.css")]
    [Asset("/assets/css/webexpress.webapp.table.css")]
    [Asset("/assets/css/webexpress.webapp.taskprogressbar.css")]
    [Asset("/assets/css/webexpress.webapp.wql.css")]
    public sealed class IncludeStyleSheet : IInclude
    {

    }
}
