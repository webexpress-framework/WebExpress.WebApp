using System.Collections.Generic;
using System.Linq;
using WebExpress.WebApp.WebScope;
using WebExpress.WebApp.WebSettingPage;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebAsset;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebEndpoint;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebIcon;
using WebExpress.WebCore.WebPage;
using WebExpress.WebCore.WebResource;
using WebExpress.WebCore.WebRestApi;
using WebExpress.WebCore.WebSettingPage;
using WebExpress.WebCore.WebSitemap;
using WebExpress.WebCore.WebSocket;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebIcon;

namespace WebExpress.WebApp.WWW.Settings.Info
{
    /// <summary>
    /// Setting page that renders the routes of the server as a tree.
    /// </summary>
    /// <remarks>
    /// The tree covers what a caller can navigate to - pages, interfaces and sockets. Assets are
    /// counted but not unfolded: they are files rather than destinations, and a server of any
    /// size serves thousands of them, which would bury the handful of routes that matter.
    /// </remarks>
    [WebIcon<IconSitemap>]
    [Title("webexpress.webapp:setting.sitemap.title")]
    [SettingGroup<SettingGroupSystemGeneral>()]
    [SettingSection(SettingSection.Secondary)]
    [Scope<IScopeAdmin>]
    public sealed class Sitemap : ISettingPage<VisualTreeWebAppSetting>, IScopeAdmin
    {
        /// <summary>
        /// The depth up to which the tree opens itself. One level shows the applications
        /// without unfolding everything they contain.
        /// </summary>
        private const int ExpandedDepth = 1;

        private readonly ISitemapManager _sitemapManager;

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="sitemapManager">The sitemap manager.</param>
        public Sitemap(ISitemapManager sitemapManager)
        {
            _sitemapManager = sitemapManager;
        }

        /// <summary>
        /// Processes the request and renders the sitemap tree into the visual tree.
        /// </summary>
        /// <param name="renderContext">The context for rendering the page.</param>
        /// <param name="visualTree">The visual tree of the web application.</param>
        public void Process(IRenderContext renderContext, VisualTreeWebAppSetting visualTree)
        {
            var panel = visualTree.Content.MainPanel;

            // the sitemap enumerates its internal nodes, and a node inherits the endpoint of a
            // descendant, so the same endpoint arrives once per level it sits under
            var endpoints = _sitemapManager?.SiteMap
                .Where(x => x is not null)
                .DistinctBy(x => x.Route?.ToString())
                .ToList() ?? [];

            panel.AddPrimary(new ControlText()
            {
                Text = _ => I18N.Translate(renderContext, "webexpress.webapp:setting.sitemap.description"),
                Margin = _ => new PropertySpacingMargin(PropertySpacing.Space.Two),
                Format = _ => TypeFormatText.Markdown
            });

            panel.AddPrimary(CreateSummary(renderContext, endpoints));

            var routes = endpoints.Where(x => x is not IAssetContext).ToList();

            if (routes.Count == 0)
            {
                panel.AddPrimary(new ControlEmptyState()
                {
                    Icon = _ => new IconSitemap(),
                    Title = _ => I18N.Translate(renderContext, "webexpress.webapp:setting.sitemap.empty.title"),
                    Message = _ => I18N.Translate(renderContext, "webexpress.webapp:setting.sitemap.empty.message")
                });

                return;
            }

            panel.AddPrimary(new ControlText()
            {
                Text = _ => I18N.Translate(renderContext, "webexpress.webapp:setting.sitemap.label"),
                TextColor = _ => new PropertyColorText(TypeColorText.Info),
                Margin = _ => new PropertySpacingMargin(PropertySpacing.Space.Two)
            });

            panel.AddPrimary(CreateTree(renderContext, routes));
        }

        /// <summary>
        /// Creates the row of key figures above the tree, which tells how much of the server is
        /// reachable before any branch is opened.
        /// </summary>
        /// <param name="renderContext">The render context.</param>
        /// <param name="endpoints">The distinct endpoints.</param>
        /// <returns>The summary panel.</returns>
        private static ControlPanel CreateSummary(IRenderContext renderContext, IEnumerable<IEndpointContext> endpoints)
        {
            var summary = new ControlPanel()
            {
                Classes = ["d-flex", "flex-wrap", "gap-2", "m-2"]
            };

            summary.Add
            (
                CreateStat(renderContext, "webexpress.webapp:setting.sitemap.stat.page", new IconFile(), endpoints.Count(x => x is IPageContext)),
                CreateStat(renderContext, "webexpress.webapp:setting.sitemap.stat.restapi", new IconPlug(), endpoints.Count(x => x is IRestApiContext)),
                CreateStat(renderContext, "webexpress.webapp:setting.sitemap.stat.socket", new IconNetworkWired(), endpoints.Count(x => x is ISocketContext)),
                CreateStat(renderContext, "webexpress.webapp:setting.sitemap.stat.asset", new IconImage(), endpoints.Count(x => x is IAssetContext))
            );

            return summary;
        }

        /// <summary>
        /// Creates a single key figure.
        /// </summary>
        /// <param name="renderContext">The render context.</param>
        /// <param name="key">The internationalization key of the caption.</param>
        /// <param name="icon">The leading icon.</param>
        /// <param name="count">The counted endpoints.</param>
        /// <returns>The tile.</returns>
        private static ControlStat CreateStat(IRenderContext renderContext, string key, IIcon icon, int count)
        {
            return new ControlStat()
            {
                Icon = _ => icon,
                Label = _ => I18N.Translate(renderContext, key),
                Value = _ => count.ToString("N0", renderContext.Request.Culture)
            };
        }

        /// <summary>
        /// Builds the route tree.
        /// </summary>
        /// <remarks>
        /// A node stands for one path segment and carries the endpoint that is reachable at
        /// exactly that path, if any. An intermediate segment that no endpoint answers stays a
        /// plain branch, so a route is never repeated as a child of itself.
        /// </remarks>
        /// <param name="renderContext">The render context.</param>
        /// <param name="endpoints">The endpoints to place.</param>
        /// <returns>The tree control.</returns>
        private static ControlTree CreateTree(IRenderContext renderContext, IEnumerable<IEndpointContext> endpoints)
        {
            var tree = new ControlTree("sitemap-tree");
            var nodes = new Dictionary<string, ControlTreeItem>();
            var roots = new List<ControlTreeItem>();

            foreach (var endpoint in endpoints.OrderBy(x => x.Route?.ToString()))
            {
                var segments = endpoint.Route?.PathSegments
                    .Select(x => x?.ToString())
                    .Where(x => !string.IsNullOrEmpty(x) && x != "/")
                    .ToList() ?? [];

                // an endpoint mounted on the server root has no segment of its own; it is shown
                // as the root entry rather than dropped
                if (segments.Count == 0)
                {
                    segments = ["/"];
                }

                var path = string.Empty;
                var parent = default(ControlTreeItem);

                for (var depth = 0; depth < segments.Count; depth++)
                {
                    var segment = segments[depth];
                    path = $"{path}/{segment}";

                    if (!nodes.TryGetValue(path, out var node))
                    {
                        node = CreateNode(segment, depth);
                        nodes.Add(path, node);

                        if (parent is null)
                        {
                            roots.Add(node);
                        }
                        else
                        {
                            parent.Add(node);
                        }
                    }

                    // only the node at the full path is the endpoint itself
                    if (depth == segments.Count - 1)
                    {
                        Decorate(renderContext, node, endpoint);
                    }

                    parent = node;
                }
            }

            tree.Add(roots);

            return tree;
        }

        /// <summary>
        /// Creates a plain branch node for a path segment.
        /// </summary>
        /// <param name="segment">The path segment the node stands for.</param>
        /// <param name="depth">The depth of the node below the root.</param>
        /// <returns>The node.</returns>
        private static ControlTreeItem CreateNode(string segment, int depth)
        {
            return new ControlTreeItem(RandomId.Create())
            {
                Text = _ => segment,
                Expand = _ => depth < ExpandedDepth,
                Icon = _ => new IconFolder()
            };
        }

        /// <summary>
        /// Turns a branch node into the endpoint that answers at its path: it becomes a link,
        /// takes the icon of its kind and names its owner in the tooltip.
        /// </summary>
        /// <param name="renderContext">The render context.</param>
        /// <param name="node">The node at the full path of the endpoint.</param>
        /// <param name="endpoint">The endpoint.</param>
        private static void Decorate(IRenderContext renderContext, ControlTreeItem node, IEndpointContext endpoint)
        {
            var route = endpoint.Route?.ToString();
            var owner = endpoint.PluginContext?.PluginId?.ToString();
            // the tooltip names one endpoint, so it takes the singular form rather than the
            // plural the counting tiles above the tree use
            var kind = I18N.Translate(renderContext, endpoint switch
            {
                IPageContext => "webexpress.webapp:setting.sitemap.kind.page",
                IRestApiContext => "webexpress.webapp:setting.sitemap.kind.restapi",
                ISocketContext => "webexpress.webapp:setting.sitemap.kind.socket",
                IResourceContext => "webexpress.webapp:setting.sitemap.kind.resource",
                _ => "webexpress.webapp:setting.sitemap.kind.asset"
            });

            node.Icon = _ => endpoint switch
            {
                IPageContext => new IconFile(),
                IRestApiContext => new IconPlug(),
                ISocketContext => new IconNetworkWired(),
                IResourceContext => new IconCube(),
                _ => new IconImage()
            };
            node.Tooltip = _ => string.Join(" - ", new[] { kind, route, owner }.Where(x => !string.IsNullOrWhiteSpace(x)));

            // a socket answers a handshake rather than a navigation, so only the kinds a browser
            // can actually open become links
            if (endpoint is IPageContext or IRestApiContext)
            {
                node.Uri = _ => endpoint.Route?.ToUri();
            }
        }
    }
}
