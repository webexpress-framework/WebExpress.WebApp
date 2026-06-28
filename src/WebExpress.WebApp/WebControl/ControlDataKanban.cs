using System;
using System.Collections.Generic;
using System.Net;
using WebExpress.WebApp.WebData;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents a control panel for API kanban interactions.
    /// </summary>
    public class ControlDataKanban : ControlPanel, IControlDataKanban, IDataIsland, IScopeBound
    {
        /// <summary>
        /// Gets or sets the name of the enclosing scope resource the board
        /// renders. When set, the control is a pure view of a central resource
        /// the scope ViewState owns; when null, it owns its state and service
        /// islands and loads itself.
        /// </summary>
        public Func<IRenderControlContext, string> Resource { get; set; }

        /// <summary>
        /// Gets or sets the optional scope id the control binds to. When null, it
        /// resolves the nearest enclosing scope by ancestry.
        /// </summary>
        public Func<IRenderControlContext, string> Scope { get; set; }

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
        /// Gets the data service descriptors of the control, emitted together as
        /// the data-wx-service island that the JavaScript engine consumes in
        /// preference to the legacy data-uri fallback, which keeps the endpoint
        /// and parameter knowledge authored in C#. When empty, the control
        /// behaves exactly as before and the client uses its legacy descriptor.
        /// See WebExpress/docs/view-state-service.md.
        /// </summary>
        public IList<Func<IRenderControlContext, DataServiceDescriptor>> ServiceFactories { get; } = [];

        /// <summary>
        /// Gets or sets the single data service descriptor, as a convenience for
        /// the common control with exactly one service. Reading returns the
        /// first declared service, assigning replaces all declared services.
        /// </summary>
        public Func<IRenderControlContext, DataServiceDescriptor> ServiceFactory
        {
            get => ServiceFactories.Count > 0 ? ServiceFactories[0] : null;
            set
            {
                ServiceFactories.Clear();

                if (value != null)
                {
                    ServiceFactories.Add(value);
                }
            }
        }

        /// <summary>
        /// Gets or sets the optional template reference, emitted as the
        /// data-wx-template attribute that the client Templates registry
        /// resolves into a registered view.
        /// </summary>
        public Func<IRenderControlContext, string> TemplateFactory { get; set; }

        /// <summary>
        /// Gets or sets the optional initial state, emitted as the data-wx-state island.
        /// </summary>
        public Func<IRenderControlContext, DataState> StateFactory { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlDataKanban(string id = null)
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
                Class = Css.Concatenate("wx-webapp-kanban", GetClasses(renderContext)),
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