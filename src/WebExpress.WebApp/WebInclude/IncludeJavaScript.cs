using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebInclude;

namespace WebExpress.WebApp.WebInclude
{
    /// <summary>
    /// Represents a collection of JavaScript resources to be included in a 
    /// web application.
    /// </summary>
    /// <remarks>
    /// This class is used to define and manage the inclusion of JavaScript 
    /// files required for the functionality of a web application.
    /// </remarks>
    [Asset("/assets/js/webexpress.webapp.js")]
    [Asset("/assets/js/webexpress.webapp.avatar.dropdown.js")]
    [Asset("/assets/js/webexpress.webapp.dashboard.js")]
    [Asset("/assets/js/webexpress.webapp.dropdown.js")]
    [Asset("/assets/js/webexpress.webapp.input.selection.js")]
    [Asset("/assets/js/webexpress.webapp.input.tile.js")]
    [Asset("/assets/js/webexpress.webapp.input.unique.js")]
    [Asset("/assets/js/webexpress.webapp.kanban.js")]
    [Asset("/assets/js/webexpress.webapp.list.js")]
    [Asset("/assets/js/webexpress.webapp.message.queue.status.js")]
    [Asset("/assets/js/webexpress.webapp.modalform.js")]
    [Asset("/assets/js/webexpress.webapp.popupnotification.js")]
    [Asset("/assets/js/webexpress.webapp.progress.task.js")]
    [Asset("/assets/js/webexpress.webapp.quickfilter.js")]
    [Asset("/assets/js/webexpress.webapp.restform.js")]
    [Asset("/assets/js/webexpress.webapp.restwizard.js")]
    [Asset("/assets/js/webexpress.webapp.search.js")]
    [Asset("/assets/js/webexpress.webapp.selection.js")]
    [Asset("/assets/js/webexpress.webapp.tab.js")]
    [Asset("/assets/js/webexpress.webapp.table.js")]
    [Asset("/assets/js/webexpress.webapp.tile.js")]
    [Asset("/assets/js/webexpress.webapp.workflow.editor.js")]
    [Asset("/assets/js/webexpress.webapp.wql.prompt.js")]
    [Asset("/assets/js/i18n/en.js")]
    [Asset("/assets/js/i18n/de.js")]
    [Asset("/assets/js/panels/webexpress.webapp.panel.workflow.guard.js")]
    [Asset("/assets/js/panels/webexpress.webapp.panel.workflow.postfunction.js")]
    [Asset("/assets/js/panels/webexpress.webapp.panel.workflow.state.properties.js")]
    [Asset("/assets/js/panels/webexpress.webapp.panel.workflow.transition.properties.js")]
    [Asset("/assets/js/panels/webexpress.webapp.panel.workflow.validator.js")]
    [Asset("/assets/js/syntax/wql.js")]
    [Asset("/assets/js/templates/default.js")]
    public sealed class IncludeJavaScript : IInclude
    {
    }
}
