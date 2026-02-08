using System;
using System.Linq;
using WebExpress.WebApp.WebScope;
using WebExpress.WebApp.WebSettingPage;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebEndpoint;
using WebExpress.WebCore.WebPage;
using WebExpress.WebCore.WebSettingPage;
using WebExpress.WebCore.WebSitemap;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebIcon;

namespace WebExpress.WebApp.WWW.Settings.Info
{
    /// <summary>
    /// Setting page that renders the application sitemap using the ControlTree control.
    /// </summary>
    [WebIcon<IconSitemap>]
    [Title("webexpress.webapp:setting.sitemap.title")]
    [SettingGroup<SettingGroupSystemGeneral>()]
    [SettingSection(SettingSection.Secondary)]
    [Scope<IScopeAdmin>]
    public sealed class Sitemap : ISettingPage<VisualTreeWebAppSetting>, IScopeAdmin
    {
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
        /// <param name="renderContext">render context for localization and rendering.</param>
        /// <param name="visualTree">visual tree of the settings page to populate.</param>
        public void Process(IRenderContext renderContext, VisualTreeWebAppSetting visualTree)
        {
            // add title text
            visualTree.Content.MainPanel.AddPrimary(new ControlText()
            {
                Text = I18N.Translate(renderContext, "webexpress.webapp:setting.sitemap.description"),
                Margin = new PropertySpacingMargin(PropertySpacing.Space.Two),
                Format = TypeFormatText.Markdown
            });

            visualTree.Content.MainPanel.AddPrimary(new ControlText()
            {
                Text = I18N.Translate(renderContext, "webexpress.webapp:setting.sitemap.label"),
                TextColor = new PropertyColorText(TypeColorText.Info),
                Margin = new PropertySpacingMargin(PropertySpacing.Space.Two)
            });

            // create the tree control
            var tree = new ControlTree("sitemap-tree");

            // try to get endpoints from sitemap manager
            var endpoints = _sitemapManager?.SiteMap?.ToList() ?? [];

            if (endpoints.Count == 0)
            {
                return;
            }

            // build hierarchical tree by path segments
            var root = new ControlTreeItem("sitemap-root")
            {
                Text = "/",
                Expand = true
            };

            foreach (var ep in endpoints)
            {
                if (ep == null)
                {
                    continue;
                }

                // get path segments as readable strings; fall back to endpoint id when no route available
                var segments = ep.Route?.PathSegments?.Select(ps => ps?.ToString() ?? string.Empty).Where(s => !string.IsNullOrEmpty(s)).ToList();

                if (segments == null || segments.Count == 0)
                {
                    // add endpoint directly under root
                    var leaf = CreateEndpointLeaf(renderContext, ep);
                    root.Add(leaf);
                    continue;
                }

                var current = root;
                // iterate segments and create/find nodes
                foreach (var seg in segments)
                {
                    // find existing child with same text
                    var child = current.Children.OfType<ControlTreeItem>().FirstOrDefault(c => string.Equals(c.Text, seg, StringComparison.Ordinal));
                    if (child == null)
                    {
                        // create new segment node
                        child = new ControlTreeItem(Guid.NewGuid().ToString("N"))
                        {
                            Text = seg,
                            Expand = true
                        };
                        current.Add(child);
                    }

                    current = child;
                }

                // at the leaf, add a node representing the endpoint
                var endpointLeaf = CreateEndpointLeaf(renderContext, ep);
                current.Add(endpointLeaf);
            }

            // if root contains nothing meaningful, show informational node
            if (!root.Children.Any())
            {
                var emptyNode = new ControlTreeItem("sitemap-empty")
                {
                    Text = I18N.Translate(renderContext, "kleenestar.core:setting.sitemap.empty"),
                    Expand = true
                };
                tree.Add(emptyNode);
            }
            else
            {
                // add all top-level children to the tree control
                tree.Add(root.Children.OfType<ControlTreeItem>());
            }

            visualTree.Content.MainPanel.AddPrimary(tree);
        }

        /// <summary>
        /// Creates a tree item representing a web endpoint for display in a control tree.
        /// </summary>
        /// <param name="renderContext">
        /// The rendering context used to provide information about the current rendering operation.
        /// </param>
        /// <param name="ep">
        /// The endpoint context containing metadata and identifiers for the web endpoint to represent.
        /// </param>
        /// <returns>
        /// A ControlTreeItem that represents the specified web endpoint, with its identifier and 
        /// display text set.
        /// </returns>
        private static ControlTreeItem CreateEndpointLeaf(IRenderContext renderContext, WebExpress.WebCore.WebEndpoint.IEndpointContext ep)
        {
            // create leaf with endpoint id as identifier
            var leaf = new ControlTreeItem($"ep-{ep.EndpointId}")
            {
                // display a readable title: prefer route template or endpoint id
                Text = GetEndpointDisplayText(ep),
                // show endpoint id as tooltip for clarity
                Tooltip = ep.EndpointId.ToString(),
                Expand = true
            };

            // if endpoint exposes a printable route, add it to tooltip as well
            try
            {
                var route = ep.Route;
                if (route != null)
                {
                    leaf.Tooltip = $"{leaf.Tooltip} - {route.ToString()}";
                }
            }
            catch
            {
                // ignore route formatting errors
            }

            return leaf;
        }

        /// <summary>
        /// Generates a user-friendly display string for the specified endpoint context.
        /// </summary>
        /// <param name="ep">
        /// The endpoint context for which to generate the display text. Cannot be null.
        /// </param>
        /// <returns>
        /// A string representing the endpoint's route path if available; otherwise, the 
        /// endpoint's identifier.
        /// </returns>
        private static string GetEndpointDisplayText(IEndpointContext ep)
        {
            // attempt to use route path or endpoint type name, fall back to endpoint id
            try
            {
                var route = ep.Route;
                if (route != null)
                {
                    var segs = route.PathSegments?.Select(s => s?.ToString()).Where(s => !string.IsNullOrEmpty(s)).ToList();
                    if (segs != null && segs.Count > 0)
                    {
                        return string.Join("/", segs);
                    }
                }
            }
            catch
            {
                // ignore
            }

            // fallback to endpoint type name or id
            return ep.EndpointId.ToString();
        }
    }
}