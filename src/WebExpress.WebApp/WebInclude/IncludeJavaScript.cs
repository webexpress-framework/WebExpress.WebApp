using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebInclude;

namespace WebExpress.WebApp.WebInclude
{
    /// <summary>
    /// Represents a collection of JavaScript resources to be included in a web application.
    /// </summary>
    /// <remarks>
    /// This class is used to define and manage the inclusion of JavaScript files required for the
    /// functionality of a web application.
    /// </remarks>
    [Asset("/assets/js/webexpress.webapp.js")]
    [Asset("/assets/js/webexpress.webapp.dropdown.js")]
    [Asset("/assets/js/webexpress.webapp.list.js")]
    [Asset("/assets/js/webexpress.webapp.modalform.js")]
    [Asset("/assets/js/webexpress.webapp.popupnotification.js")]
    [Asset("/assets/js/webexpress.webapp.progress.task.js")]
    [Asset("/assets/js/webexpress.webapp.selection.js")]
    [Asset("/assets/js/webexpress.webapp.table.js")]
    [Asset("/assets/js/i18n/en.js")]
    [Asset("/assets/js/i18n/de.js")]
    public sealed class IncludeJavaScript : IInclude
    {
    }
}
