using System.Collections.Generic;
using System.Linq;
using System.Net;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebData
{
    /// <summary>
    /// The shared emission helper for data bound controls. It turns the declared
    /// state and services of an <see cref="IDataIsland"/> into hidden island
    /// elements at the start of the host element: the wx-state island that the
    /// engine seeds its store from and one wx-service island per declared
    /// service, which the ServiceRegistry resolves into configured services.
    /// The declared template reference stays an attribute (data-wx-template),
    /// because it is a plain string and not structured data. The engine consumes
    /// the island elements when it reads them, so they never reach the visible
    /// DOM of a mounted control.
    /// </summary>
    public static class DataIslandExtensions
    {
        /// <summary>
        /// Emits the wx-state and wx-service island elements as the first
        /// children of the host element and the data-wx-template reference as an
        /// attribute, from the control's declarations. The islands come first so
        /// the engine finds them before any rendered content and a control that
        /// relocates its children keeps them out of the visible panes.
        /// </summary>
        /// <param name="html">The host element.</param>
        /// <param name="control">The data bound control.</param>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <returns>The host element for chaining.</returns>
        public static IHtmlNode EmitDataIslands(this IHtmlNode html, IDataIsland control, IRenderControlContext renderContext)
        {
            if (control == null || html is not HtmlElement host)
            {
                return html;
            }

            var state = control.StateFactory?.Invoke(renderContext);
            var descriptors = (control.ServiceFactories ?? [])
                .Select(factory => factory?.Invoke(renderContext))
                .Where(descriptor => descriptor != null)
                .ToList();
            var template = control.TemplateFactory?.Invoke(renderContext);

            var islands = new List<IHtmlNode>();

            if (state != null && !state.IsEmpty)
            {
                islands.Add(state.ToIslandElement());
            }

            islands.AddRange(descriptors.Select(descriptor => descriptor.ToIslandElement()));

            if (islands.Count > 0)
            {
                host.AddFirst([.. islands]);
            }

            host.AddUserAttribute("data-wx-template", !string.IsNullOrEmpty(template) ? WebUtility.HtmlEncode(template) : null);

            return html;
        }

        /// <summary>
        /// Emits single wx-service island elements as the first children of the
        /// host element. This is the emission path for controls that author
        /// their endpoint through a rest uri property rather than declared
        /// service factories; the control builds the descriptor that matches
        /// its client contract and the wire format stays identical to the
        /// declared service emission. Null descriptors are skipped, so a
        /// control passes its optional endpoints unconditionally.
        /// </summary>
        /// <param name="html">The host element.</param>
        /// <param name="descriptors">The service descriptors.</param>
        /// <returns>The host element for chaining.</returns>
        public static IHtmlNode EmitServiceIslands(this IHtmlNode html, params DataServiceDescriptor[] descriptors)
        {
            if (html is not HtmlElement host)
            {
                return html;
            }

            var islands = descriptors
                .Where(descriptor => descriptor != null)
                .Select(descriptor => (IHtmlNode)descriptor.ToIslandElement())
                .ToArray();

            if (islands.Length > 0)
            {
                host.AddFirst(islands);
            }

            return html;
        }
    }
}
