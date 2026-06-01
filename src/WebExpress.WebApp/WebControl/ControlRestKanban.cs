using System;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents a control panel for API kanban interactions.
    /// </summary>
    public class ControlRestKanban : ControlPanel, IControlRestKanban
    {
        /// <summary>
        /// Gets or sets the uri that determines the data.
        /// </summary>
        public Func<IRenderControlContext, IUri> RestUri { get; set; }

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
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlRestKanban(string id = null)
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
            var uri = RestUri?.Invoke(renderContext);
            var resultUri = uri?.BindParameters(renderContext.Request);
            var editableColumn = EditableColumn?.Invoke(renderContext) ?? false;
            var movableColumn = MovableColumn?.Invoke(renderContext) ?? false;
            var deletableColumn = DeletableColumn?.Invoke(renderContext) ?? false;

            var html = new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-kanban", GetClasses(renderContext)),
                Style = GetStyles(renderContext)
            }
                .AddUserAttribute("data-uri", resultUri?.ToString())
                .AddUserAttribute("data-editable-column", editableColumn ? "true" : null)
                .AddUserAttribute("data-movable-column", movableColumn ? "true" : null)
                .AddUserAttribute("data-deletable-column", deletableColumn ? "true" : null);

            return html;
        }
    }
}