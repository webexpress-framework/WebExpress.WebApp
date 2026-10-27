using WebExpress.WebCore.WebHtml;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Icon set picker backed by a <see cref="WebRestApi.RestApiIconSet"/> endpoint.
    /// </summary>
    /// <remarks>
    /// The endpoint answers in the envelope of the theme endpoint, so the picker is the theme
    /// dropdown with its own hover text and its own client class: a set is a stylesheet the
    /// page can swap at once, so a pick takes effect without the reload a theme needs. Without
    /// a stored choice the first offered set is shown, which is why an application lists the
    /// framework drawings first.
    /// </remarks>
    public class ControlDataSelectionIconSet : ControlDataSelectionTheme
    {
        /// <summary>
        /// Initializes a new instance of the class with an automatically assigned id.
        /// </summary>
        public ControlDataSelectionIconSet()
            : this(null)
        {
        }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlDataSelectionIconSet(string id)
            : base(id)
        {
            Tooltip = _ => "webexpress.webapp:setting.theme.iconset.tooltip";
        }

        /// <summary>
        /// Converts the control to an HTML representation bound to the icon set controller
        /// (<c>webexpress.webapp.DropdownIconSetCtrl</c>) instead of the theme controller.
        /// </summary>
        /// <param name="renderContext">The rendering context.</param>
        /// <param name="visualTree">The visual tree.</param>
        /// <returns>An html node representing the rendered control.</returns>
        public override IHtmlNode Render(IRenderControlContext renderContext, IVisualTreeControl visualTree)
        {
            return base.Render(renderContext, visualTree)
                .RemoveClass("wx-webapp-dropdown-theme")
                .AddClass("wx-webapp-dropdown-iconset");
        }
    }
}
