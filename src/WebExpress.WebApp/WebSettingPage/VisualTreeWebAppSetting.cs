using System.Linq;
using WebExpress.WebApp.WebControl;
using WebExpress.WebApp.WebPage;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebComponent;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebPage;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebSettingPage
{
    /// <summary>
    /// Represents the visual tree of the web application for setting pages.
    /// </summary>
    public class VisualTreeWebAppSetting : VisualTreeWebApp
    {
        /// <summary>
        /// Returns the area for setting tab.
        /// </summary>
        public ControlWebAppSettingTab SettingTab { get; protected set; } = new ControlWebAppSettingTab("wx-settingtab");

        /// <summary>
        /// Returns the sidebar control.
        /// </summary>
        public new ControlWebAppSettingMenu Sidebar { get; protected set; } = new ControlWebAppSettingMenu("wx-settingmenu");

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="componentHub">The component hub.</param>
        /// <param name="pageContext">The page context.</param>
        public VisualTreeWebAppSetting(IComponentHub componentHub, IPageContext pageContext)
            : base(componentHub, pageContext)
        {
        }

        /// <summary>
        /// Convert to html.
        /// </summary>
        /// <param name="context">The context for rendering the page.</param>
        /// <returns>The page as an html tree.</returns>
        public override IHtmlNode Render(IVisualTreeContext context)
        {
            var html = new HtmlElementRootHtml();
            var body = new HtmlElementSectionBody();
            var renderContext = new RenderControlContext(context.RenderContext);

            Breadcrumb.Prefix = "webexpress.webapp:setting.label";
            Breadcrumb.TakeLast = 1;

            html.Head.Title = I18N.Translate(context.Request, Title);
            html.Head.Favicons = Favicons;
            html.Head.Styles = Styles;
            html.Head.Meta = Meta;
            html.Head.Scripts = HeaderScripts;
            html.Head.CssLinks = CssLinks.Where(x => x != null).Select(x => x.ToString());
            html.Head.ScriptLinks = HeaderScriptLinks?.Where(x => x != null).Select(x => x.ToString());

            // header
            Header.AppTitle.Text = html.Head.Title;
            html.Body.Add(Header.Render(renderContext, this));
            html.Body.Add(Toast.Render(renderContext, this));
            html.Body.Add(Breadcrumb.Render(renderContext, this));
            html.Body.Add(Prologue.Render(renderContext, this));
            html.Body.Add(SettingTab.Render(renderContext, this));

            var split = new ControlPanelSplit
            (
                "wx-split",
                [Sidebar],
                [Content]
            )
            {
                Border = new PropertyBorder(true),
                Orientation = TypeOrientationSplit.Horizontal,
                SidePanelInitialSize = 350,
                SidePanelMinSize = 150
            };

            html.Body.Add(split.Render(renderContext, this));
            html.Body.Add(Footer.Render(renderContext, this));
            html.Body.Add(NotificationPopup.Render(renderContext, this));

            html.Body.Scripts = [.. Scripts.Values];

            return html;
        }
    }
}
