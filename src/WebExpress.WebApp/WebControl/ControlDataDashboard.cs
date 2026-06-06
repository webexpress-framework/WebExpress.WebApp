using System;
using System.Net;
using WebExpress.WebApp.WebData;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents a control panel for API dashboard interactions.
    /// </summary>
    public class ControlDataDashboard : ControlPanel, IControlDataDashboard, IDataIsland
    {
        /// <summary>
        /// Gets or sets a value indicating whether the column headers can be
        /// renamed inline (smart-edit). The new column layout is persisted to
        /// the REST endpoint.
        /// </summary>
        public Func<IRenderControlContext, bool> EditableColumn { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether the columns can be reordered
        /// via drag and drop (⠿ grip). The new order is persisted to the REST
        /// endpoint.
        /// </summary>
        public Func<IRenderControlContext, bool> MovableColumn { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether the columns can be deleted.
        /// The new column layout is persisted to the REST endpoint.
        /// </summary>
        public Func<IRenderControlContext, bool> DeletableColumn { get; set; }

        /// <summary>
        /// Gets or sets the optional data service descriptor. When set, the
        /// control emits a data-wx-service island the JavaScript engine consumes
        /// in preference to the legacy data-uri fallback. See
        /// WebExpress/docs/view-state-service.md.
        /// </summary>
        public Func<IRenderControlContext, DataServiceDescriptor> ServiceFactory { get; set; }

        /// <summary>
        /// Gets or sets the optional initial state, emitted as the data-wx-state island.
        /// </summary>
        public Func<IRenderControlContext, DataState> StateFactory { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlDataDashboard(string id = null)
            : base(id ?? RandomId.Create())
        {
        }

        /// <summary>
        /// Converts the control to an HTML representation.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <param name="visualTree">The visual tree.</param>
        /// <returns>An HTML node representing the rendered control.</returns>
        public override IHtmlNode Render(IRenderControlContext renderContext, IVisualTreeControl visualTree)
        {
            var editableColumn = EditableColumn?.Invoke(renderContext) ?? false;
            var movableColumn = MovableColumn?.Invoke(renderContext) ?? false;
            var deletableColumn = DeletableColumn?.Invoke(renderContext) ?? false;

            var html = new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-dashboard", GetClasses(renderContext)),
                Style = GetStyles(renderContext)
            }
                .AddUserAttribute("data-editable-column", editableColumn ? "true" : null)
                .AddUserAttribute("data-movable-column", movableColumn ? "true" : null)
                .AddUserAttribute("data-deletable-column", deletableColumn ? "true" : null)
                .EmitDataIslands(this, renderContext);

            return html;
        }
    }
}