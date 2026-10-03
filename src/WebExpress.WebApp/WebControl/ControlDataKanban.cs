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
    public class ControlDataKanban : ControlPanel, IControlDataKanban, IDataIsland, IViewStateBound
    {
        /// <summary>
        /// Gets or sets the name of the enclosing ViewState resource the board
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
        /// to add a new column. The menu shares the look and feel of the
        /// dashboard board menu; the new column layout is persisted to the REST
        /// endpoint.
        /// </summary>
        public Func<IRenderControlContext, bool> AddableColumn { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether the board offers the "…" menu
        /// to add a new swimlane. The new swimlane list is persisted to the REST
        /// endpoint.
        /// </summary>
        public Func<IRenderControlContext, bool> AddableSwimlane { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether a swimlane can be renamed
        /// through its "…" menu. The new swimlane list is persisted to the REST
        /// endpoint.
        /// </summary>
        public Func<IRenderControlContext, bool> EditableSwimlane { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether a swimlane can be deleted
        /// through its "…" menu. The new swimlane list is persisted to the REST
        /// endpoint.
        /// </summary>
        public Func<IRenderControlContext, bool> DeletableSwimlane { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether a swimlane can be reordered
        /// (moved up or down) through its "…" menu. The new swimlane order is
        /// persisted to the REST endpoint.
        /// </summary>
        public Func<IRenderControlContext, bool> MovableSwimlane { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether the board offers the "…" menu
        /// entry that opens the settings dialog. The dialog carries the WQL
        /// filter that restricts which cards the board loads; the submitted
        /// filter is persisted to the REST endpoint and applied on the next load.
        /// </summary>
        public Func<IRenderControlContext, bool> ConfigurableBoard { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether a swimlane offers the "…" menu
        /// entry that opens the settings dialog. The dialog carries the swimlane
        /// WQL filter that restricts which cards the lane shows; the submitted
        /// filter is persisted to the REST endpoint.
        /// </summary>
        public Func<IRenderControlContext, bool> ConfigurableSwimlane { get; set; }

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
        /// Gets or sets a value indicating whether clicking a card selects it. A selected
        /// card is marked active and announced through the selection event, which is what
        /// lets a board drive a master-detail view like a list or a backlog does. Turn it
        /// off for a board that is purely a drag surface.
        /// </summary>
        public Func<IRenderControlContext, bool> Selectable { get; set; } = _ => true;

        /// <summary>
        /// Gets or sets whether the board takes the height its host offers
        /// instead of growing with its longest column.
        /// </summary>
        /// <remarks>
        /// A board that grows is the right shape for one block among others on a
        /// page. Where the board *is* the view, it is the wrong one: the page
        /// scrolls around it and takes the column headers along, so what a board
        /// is read by leaves the screen. Filling bounds the board instead, and the
        /// cards scroll under headers that stay.
        ///
        /// A host that is a flex column - which the WebApp content panel becomes
        /// on its own for a filling control - drives the height. A host that hands
        /// nothing down falls back to the self-imposed default of the
        /// <c>--wx-kanban-height</c> custom property, never to the content: the
        /// board only scrolls while it is bounded.
        /// </remarks>
        public Func<IRenderControlContext, bool> Fill { get; set; } = _ => false;

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
            var addableColumn = AddableColumn?.Invoke(renderContext) ?? false;
            var addableSwimlane = AddableSwimlane?.Invoke(renderContext) ?? false;
            var editableSwimlane = EditableSwimlane?.Invoke(renderContext) ?? false;
            var deletableSwimlane = DeletableSwimlane?.Invoke(renderContext) ?? false;
            var movableSwimlane = MovableSwimlane?.Invoke(renderContext) ?? false;
            var configurableBoard = ConfigurableBoard?.Invoke(renderContext) ?? false;
            var configurableSwimlane = ConfigurableSwimlane?.Invoke(renderContext) ?? false;
            var selectable = Selectable?.Invoke(renderContext) ?? true;
            var fill = Fill?.Invoke(renderContext) ?? false;

            var html = new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-kanban", fill ? "wx-fill" : null, GetClasses(renderContext)),
                Style = GetStyles(renderContext)
            }
                .AddUserAttribute("data-editable-column", editableColumn ? "true" : null)
                .AddUserAttribute("data-movable-column", movableColumn ? "true" : null)
                .AddUserAttribute("data-deletable-column", deletableColumn ? "true" : null)
                .AddUserAttribute("data-addable-column", addableColumn ? "true" : null)
                .AddUserAttribute("data-addable-swimlane", addableSwimlane ? "true" : null)
                .AddUserAttribute("data-editable-swimlane", editableSwimlane ? "true" : null)
                .AddUserAttribute("data-deletable-swimlane", deletableSwimlane ? "true" : null)
                .AddUserAttribute("data-movable-swimlane", movableSwimlane ? "true" : null)
                .AddUserAttribute("data-configurable-board", configurableBoard ? "true" : null)
                .AddUserAttribute("data-configurable-swimlane", configurableSwimlane ? "true" : null)
                // emitted only to opt out, so the attribute stays absent on the common
                // selectable board and the client default carries it
                .AddUserAttribute("data-selectable", selectable ? null : "false")
                .EmitDataIslands(this, renderContext);

            return html;
        }
    }
}