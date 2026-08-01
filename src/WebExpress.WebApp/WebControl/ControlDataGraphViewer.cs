using System;
using System.Collections.Generic;
using WebExpress.WebApp.WebData;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents a REST-backed graph viewer. The server authors the endpoint
    /// through the wx-service island and optionally seeds the graph through the
    /// wx-state island; the client loads the nodes and edges and renders them
    /// with the pan, zoom and drag surface of the WebUI graph viewer.
    /// </summary>
    /// <remarks>
    /// The viewer is read-only, so it declares a query service alone. A graph
    /// that is also authored belongs in the workflow editor, which owns the
    /// editing surface and the write path.
    /// </remarks>
    public class ControlDataGraphViewer : ControlPanel, IControlDataGraphViewer, IDataIsland, IViewStateBound
    {
        /// <summary>
        /// Gets or sets the name of the enclosing ViewState resource the graph
        /// renders. When set, the control is a pure view of a central resource
        /// the ViewState owns; when null, it owns its state and service islands
        /// and loads itself.
        /// </summary>
        public Func<IRenderControlContext, string> ResourceFactory { get; set; }

        /// <summary>
        /// Gets or sets the optional ViewState id the control binds to. When null, it
        /// resolves the nearest enclosing ViewState by ancestry.
        /// </summary>
        public Func<IRenderControlContext, string> ViewState { get; set; }

        /// <summary>
        /// Gets or sets the style used to render nodes that carry no style of
        /// their own, which is how a graph gets a consistent look without
        /// repeating the layout on every node the endpoint delivers.
        /// </summary>
        public Func<IRenderControlContext, TypeStyleGraphNode> NodeStyle { get; set; }

        /// <summary>
        /// Gets or sets the style used to route the edges. The default keeps the
        /// segments straight and rounds the corner at each waypoint, so a
        /// waypoint stays readable as the routing decision it is.
        /// </summary>
        public Func<IRenderControlContext, TypeStyleGraphEdge> EdgeStyle { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether the layout simulation places
        /// the nodes that arrive without coordinates. It is on unless switched
        /// off; a graph whose endpoint delivers every position is better served
        /// without it, because the simulation would move the authored layout.
        /// </summary>
        public Func<IRenderControlContext, bool> Physics { get; set; }

        /// <summary>
        /// Gets or sets the cell size of the background grid, in canvas units. A
        /// value of 0 (the default) leaves the grid off; the grid is a reading
        /// aid, so it is shown only where it is asked for.
        /// </summary>
        public Func<IRenderControlContext, int> Grid { get; set; }

        /// <summary>
        /// Gets or sets whether dragging a node snaps it to the grid. Has no
        /// effect while <see cref="Grid"/> is 0.
        /// </summary>
        public Func<IRenderControlContext, bool> GridSnap { get; set; }

        /// <summary>
        /// Gets or sets the accessible name announced for the canvas. The canvas
        /// is a single tab stop whose content is pure geometry, so without a name
        /// a screen reader has nothing to announce it by.
        /// </summary>
        public Func<IRenderControlContext, string> Label { get; set; }

        /// <summary>
        /// Gets the data service descriptors of the control, emitted together as
        /// the data-wx-service island that the JavaScript engine consumes. The
        /// data service loads the graph with GET.
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
        /// data-wx-template attribute.
        /// </summary>
        public Func<IRenderControlContext, string> TemplateFactory { get; set; }

        /// <summary>
        /// Gets or sets the optional initial state, emitted as the wx-state island.
        /// </summary>
        public Func<IRenderControlContext, DataState> StateFactory { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlDataGraphViewer(string id = null)
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
            var nodeStyle = NodeStyle?.Invoke(renderContext) ?? TypeStyleGraphNode.Default;
            var edgeStyle = EdgeStyle?.Invoke(renderContext) ?? TypeStyleGraphEdge.Default;
            var grid = Grid?.Invoke(renderContext) ?? 0;
            var label = Label?.Invoke(renderContext);

            var html = new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-graph-viewer", GetClasses(renderContext)),
                Style = GetStyles(renderContext),
                Role = "region"
            }
                .AddUserAttribute("data-node-style", nodeStyle != TypeStyleGraphNode.Default ? nodeStyle.ToValue() : null)
                .AddUserAttribute("data-edge-style", edgeStyle != TypeStyleGraphEdge.Default ? edgeStyle.ToValue() : null)
                // the client enables the simulation unless it reads an explicit
                // "false", so only the opt-out is worth an attribute
                .AddUserAttribute("data-physics-enabled", Physics != null && !Physics(renderContext) ? "false" : null)
                .AddUserAttribute("data-grid", grid > 0 ? grid.ToString() : null)
                .AddUserAttribute("data-grid-snap", grid > 0 && (GridSnap?.Invoke(renderContext) ?? false) ? "true" : null)
                .AddUserAttribute("data-label", !string.IsNullOrEmpty(label) ? label : null)
                .EmitDataIslands(this, renderContext);

            return html;
        }
    }
}
