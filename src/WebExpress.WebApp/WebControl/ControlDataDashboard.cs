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
    /// Represents a control panel for API dashboard interactions.
    /// </summary>
    public class ControlDataDashboard : ControlPanel, IControlDataDashboard, IDataIsland, IViewStateBound
    {
        /// <summary>
        /// Gets or sets the name of the enclosing ViewState resource the dashboard
        /// renders. When set, the control is a pure view of a central resource
        /// the ViewState owns; when null, it owns its state and service
        /// islands and loads itself.
        /// </summary>
        public Func<IRenderControlContext, string> ResourceFactory { get; set; }

        /// <summary>
        /// Gets or sets the optional ViewState id the control binds to. When null, it
        /// resolves the nearest enclosing ViewState by ancestry.
        /// </summary>
        public Func<IRenderControlContext, string> ViewState { get; set; }

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
        /// Gets or sets a value indicating whether the board offers the "…" menu
        /// to add a new column. The menu shares the look and feel of the tab add
        /// (+) control; the new column layout is persisted to the REST endpoint.
        /// </summary>
        public Func<IRenderControlContext, bool> AddableColumn { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether the board offers the "…" menu
        /// to add a new widget (dashboard item). The available item types are
        /// restricted by <see cref="AvailableWidgets"/> when set, otherwise every
        /// widget the client registry flags as available is offered.
        /// </summary>
        public Func<IRenderControlContext, bool> AddableWidget { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether each widget offers a settings
        /// entry in its "…" menu. The settings dialog always carries the name and
        /// color, plus any type-specific fields the widget declares. The delete
        /// entry stays available independently of this flag.
        /// </summary>
        public Func<IRenderControlContext, bool> ConfigurableWidget { get; set; }

        /// <summary>
        /// Gets or sets whether the board takes the height its host offers
        /// instead of growing with its longest column.
        /// </summary>
        /// <remarks>
        /// A board that grows is the right shape for one block among others on a
        /// page. Where the board *is* the view, it is the wrong one: the page
        /// scrolls around it and takes the "…" menu above the columns along, so
        /// the way to add a column or a widget leaves the screen. Filling bounds
        /// the board, and the widgets scroll below a menu bar that stays.
        ///
        /// A host that is a flex column - which the WebApp content panel becomes
        /// on its own for a filling control - drives the height. A host that hands
        /// nothing down falls back to the self-imposed default of the
        /// <c>--wx-dashboard-height</c> custom property, never to the content: the
        /// columns only scroll while the board is bounded.
        /// </remarks>
        public Func<IRenderControlContext, bool> Fill { get; set; } = _ => false;

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
            var addableColumn = AddableColumn?.Invoke(renderContext) ?? false;
            var addableWidget = AddableWidget?.Invoke(renderContext) ?? false;
            var configurableWidget = ConfigurableWidget?.Invoke(renderContext) ?? false;
            var fill = Fill?.Invoke(renderContext) ?? false;

            var html = new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-dashboard", fill ? "wx-fill" : null, GetClasses(renderContext)),
                Style = GetStyles(renderContext)
            }
                .AddUserAttribute("data-editable-column", editableColumn ? "true" : null)
                .AddUserAttribute("data-movable-column", movableColumn ? "true" : null)
                .AddUserAttribute("data-deletable-column", deletableColumn ? "true" : null)
                .AddUserAttribute("data-addable-column", addableColumn ? "true" : null)
                .AddUserAttribute("data-addable-widget", addableWidget ? "true" : null)
                .AddUserAttribute("data-configurable-widget", configurableWidget ? "true" : null)
                .EmitDataIslands(this, renderContext);

            return html;
        }
    }
}