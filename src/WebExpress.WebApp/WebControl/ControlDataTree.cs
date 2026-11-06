using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using WebExpress.WebApp.WebData;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// A tree over a REST endpoint (see <see cref="WebRestApi.RestApiTree{TIndexItem}"/>) that
    /// loads one level per expansion. The static tree renders every node into the page and does
    /// not scale beyond a few hundred; a hierarchical data set - pages, org units, a configuration
    /// database - opens here as fast as its first level.
    /// </summary>
    /// <remarks>
    /// The endpoint is bound with <c>.DataService&lt;TEndpoint&gt;()</c>. The tree follows the
    /// ARIA tree pattern, keeps its expansion across reloads and, when movable, moves nodes with
    /// the drag-and-drop protocol of WebUI and announces each move with the move event of the
    /// static tree.
    /// </remarks>
    public class ControlDataTree : Control, IDataIsland
    {
        /// <summary>
        /// Gets or sets whether nodes can be moved by drag and drop. A move is sent to the
        /// endpoint as PUT and the touched levels are read back.
        /// </summary>
        public Func<IRenderControlContext, bool> Movable { get; set; }

        /// <summary>
        /// Gets or sets the id of the node that is selected when the tree opens. A node below the
        /// first level is revealed: the endpoint names its ancestors and the tree opens them.
        /// </summary>
        public Func<IRenderControlContext, string> Selected { get; set; }

        /// <summary>
        /// Gets or sets the ids of the nodes that are open when the tree loads, so a page shows
        /// the part of the hierarchy it is about.
        /// </summary>
        public Func<IRenderControlContext, IEnumerable<string>> Expanded { get; set; }

        /// <summary>
        /// Gets or sets the factory of the state island.
        /// </summary>
        public Func<IRenderControlContext, DataState> StateFactory { get; set; }

        /// <summary>
        /// Gets the factories of the service islands.
        /// </summary>
        public IList<Func<IRenderControlContext, DataServiceDescriptor>> ServiceFactories { get; } = [];

        /// <summary>
        /// Gets or sets the single service factory; setting it replaces all services.
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
        /// Gets or sets the factory of the template id.
        /// </summary>
        public Func<IRenderControlContext, string> TemplateFactory { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlDataTree(string id = null)
            : base(id ?? RandomId.Create())
        {
        }

        /// <summary>
        /// Converts the control to an HTML representation.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <param name="visualTree">The visual tree representing the control's structure.</param>
        /// <returns>An HTML node representing the rendered control.</returns>
        public override IHtmlNode Render(IRenderControlContext renderContext, IVisualTreeControl visualTree)
        {
            if (!(Enable?.Invoke(renderContext) ?? true))
            {
                return null;
            }

            var movable = Movable?.Invoke(renderContext) ?? false;
            var expanded = Expanded?.Invoke(renderContext)?.Where(x => !string.IsNullOrWhiteSpace(x)).ToArray() ?? [];

            var html = new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-tree", GetClasses(renderContext)),
                Style = GetStyles(renderContext),
                Role = Role?.Invoke(renderContext)
            }
                .AddUserAttribute("data-movable", movable ? "true" : null)
                .AddUserAttribute("data-selected", Selected?.Invoke(renderContext))
                .AddUserAttribute("data-expanded", expanded.Length > 0 ? JsonSerializer.Serialize(expanded) : null);

            html.EmitDataIslands(this, renderContext);

            return html;
        }
    }
}
