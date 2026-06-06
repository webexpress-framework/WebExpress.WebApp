using System.Net;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebData
{
    /// <summary>
    /// The shared emission helper for data bound controls. It turns the declared
    /// state and service of an <see cref="IDataIsland"/> into the additive data
    /// attribute contract: the data-wx-state island that the engine seeds its
    /// store from and the data-wx-service island that the ServiceRegistry resolves
    /// into a configured service. Both are HTML attribute encoded so their json
    /// quotes do not break the markup, and an absent or empty island is omitted.
    /// </summary>
    public static class DataIslandExtensions
    {
        /// <summary>
        /// Emits the data-wx-state and data-wx-service islands on a host element
        /// from the control's declared state and service. The attributes are added
        /// last, after the control's own attributes, so the legacy attributes keep
        /// their place and the islands sit beside them.
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
            var service = control.ServiceFactory?.Invoke(renderContext);

            html.AddUserAttribute("data-wx-state", state != null && !state.IsEmpty ? WebUtility.HtmlEncode(state.ToIsland()) : null);
            html.AddUserAttribute("data-wx-service", service != null ? WebUtility.HtmlEncode(service.ToIsland()) : null);

            return html;
        }
    }
}
