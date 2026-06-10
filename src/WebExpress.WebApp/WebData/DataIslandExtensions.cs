using System.Collections.Generic;
using System.Linq;
using System.Net;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebData
{
    /// <summary>
    /// The shared emission helper for data bound controls. It turns the declared
    /// state, services and template of an <see cref="IDataIsland"/> into the
    /// additive data attribute contract: the data-wx-state island that the engine
    /// seeds its store from, the data-wx-service island that the ServiceRegistry
    /// resolves into configured services (a single object for one service, a json
    /// array for several) and the data-wx-template reference that the Templates
    /// registry resolves into a view. The islands are HTML attribute encoded so
    /// their json quotes do not break the markup, and an absent or empty island
    /// is omitted.
    /// </summary>
    public static class DataIslandExtensions
    {
        /// <summary>
        /// Emits the data-wx-state, data-wx-service and data-wx-template islands
        /// on a host element from the control's declarations. The attributes are
        /// added last, after the control's own attributes, so the legacy
        /// attributes keep their place and the islands sit beside them.
        /// </summary>
        /// <param name="html">The host element.</param>
        /// <param name="control">The data bound control.</param>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <returns>The host element for chaining.</returns>
        public static IHtmlNode EmitDataIslands(this IHtmlNode html, IDataIsland control, IRenderControlContext renderContext)
        {
            if (control == null || html == null)
            {
                return html;
            }

            var state = control.StateFactory?.Invoke(renderContext);
            var services = BuildServiceIsland(control, renderContext);
            var template = control.TemplateFactory?.Invoke(renderContext);

            html.AddUserAttribute("data-wx-state", state != null && !state.IsEmpty ? WebUtility.HtmlEncode(state.ToIsland()) : null);
            html.AddUserAttribute("data-wx-service", services != null ? WebUtility.HtmlEncode(services) : null);
            html.AddUserAttribute("data-wx-template", !string.IsNullOrEmpty(template) ? WebUtility.HtmlEncode(template) : null);

            return html;
        }

        /// <summary>
        /// Builds the json of the data-wx-service island from the declared
        /// service factories. One service serializes to a single object, which
        /// keeps the island identical to the historical single service contract,
        /// and several services serialize to a json array.
        /// </summary>
        /// <param name="control">The data bound control.</param>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <returns>The island json, or null when no service is declared.</returns>
        private static string BuildServiceIsland(IDataIsland control, IRenderControlContext renderContext)
        {
            var descriptors = (control.ServiceFactories ?? [])
                .Select(factory => factory?.Invoke(renderContext))
                .Where(descriptor => descriptor != null)
                .ToList();

            return descriptors.Count switch
            {
                0 => null,
                1 => descriptors[0].ToIsland(),
                _ => "[" + string.Join(",", descriptors.Select(descriptor => descriptor.ToIsland())) + "]"
            };
        }
    }
}
