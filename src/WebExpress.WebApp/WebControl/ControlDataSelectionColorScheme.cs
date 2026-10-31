using WebExpress.WebApp.WebTheme;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Light or dark picker backed by a <see cref="WebRestApi.RestApiColorScheme"/> endpoint.
    /// </summary>
    /// <remarks>
    /// The endpoint answers in the envelope of the theme endpoint, so the picker is the theme
    /// dropdown with its own hover text. A visitor who has not chosen sees the default of the
    /// theme, which the endpoint cannot know; the picker therefore carries the mode the page
    /// is rendered in as its preset. It reloads after a pick, so the theme's stylesheet and
    /// every control render in the new mode.
    /// </remarks>
    public class ControlDataSelectionColorScheme : ControlDataSelectionTheme
    {
        /// <summary>
        /// Initializes a new instance of the class with an automatically assigned id.
        /// </summary>
        public ControlDataSelectionColorScheme()
            : this(null)
        {
        }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlDataSelectionColorScheme(string id)
            : base(id)
        {
            Tooltip = _ => "webexpress.webapp:setting.theme.mode.tooltip";
        }

        /// <summary>
        /// Converts the control to an HTML representation with the mode in use as its preset.
        /// </summary>
        /// <param name="renderContext">The rendering context.</param>
        /// <param name="visualTree">The visual tree.</param>
        /// <returns>An html node representing the rendered control.</returns>
        public override IHtmlNode Render(IRenderControlContext renderContext, IVisualTreeControl visualTree)
        {
            return base.Render(renderContext, visualTree)
                .AddUserAttribute("data-default", ThemePreferences.EffectiveColorScheme(renderContext, visualTree?.Theme));
        }
    }
}
