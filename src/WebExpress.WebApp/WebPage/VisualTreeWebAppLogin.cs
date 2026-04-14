using System.Linq;
using WebExpress.WebApp.WebControl;
using WebExpress.WebApp.WebPage;
using WebExpress.WebCore;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebComponent;
using WebExpress.WebCore.WebEndpoint;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebPage;
using WebExpress.WebCore.WebTheme;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebPage
{
    /// <summary>
    /// Represents a simplified visual tree used for login, logout, and access-denied pages.
    /// The layout omits the sidebar and breadcrumb, and centers the content within the page.
    /// </summary>
    public class VisualTreeWebAppLogin : VisualTreeControl, IVisualTreeWebApp
    {
        /// <summary>
        /// Returns or sets the theme of the web application.
        /// </summary>
        public IThemeContext Theme { get; set; }

        /// <summary>
        /// Returns header control.
        /// </summary>
        public ControlWebAppHeader Header { get; } = new ControlWebAppHeader("wx-header");

        /// <summary>
        /// Returns the area for the toast messages control.
        /// </summary>
        public ControlWebAppToastnotification Toast { get; protected set; } = new ControlWebAppToastnotification("wx-toast");

        /// <summary>
        /// Returns the range for the path specification.
        /// Not rendered in the login visual tree.
        /// </summary>
        public ControlBreadcrumb Breadcrumb { get; protected set; } = new ControlBreadcrumb("wx-breadcrumb");

        /// <summary>
        /// Returns the area for prologue.
        /// Not rendered in the login visual tree.
        /// </summary>
        public ControlWebAppPrologue Prologue { get; protected set; } = new ControlWebAppPrologue("wx-prologue");

        /// <summary>
        /// Returns the sidebar control.
        /// Not rendered in the login visual tree.
        /// </summary>
        public IControlWebAppSidebar Sidebar { get; protected set; } = new ControlWebAppSidebar("wx-sidebar");

        /// <summary>
        /// Returns the content control.
        /// </summary>
        public new IControlWebAppContent Content { get; protected set; } = new ControlWebAppContent("wx-content");

        /// <summary>
        /// Returns the footer control.
        /// </summary>
        public IControlWebAppFooter Footer { get; protected set; } = new ControlWebAppFooter("wx-footer");

        /// <summary>
        /// Returns the control for displaying notification popups via API.
        /// </summary>
        public ControlRestPopupNotification NotificationPopup { get; protected set; } = new ControlRestPopupNotification("wx-notificationpopup");

        /// <summary>
        /// Returns or sets a delegate that returns the collection of domain names associated with
        /// the current context. Not used in the login visual tree.
        /// </summary>
        public System.Func<System.Collections.Generic.IEnumerable<string>> Domains { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="componentHub">The component hub.</param>
        /// <param name="pageContext">The page context.</param>
        public VisualTreeWebAppLogin(IComponentHub componentHub, IPageContext pageContext)
            : base(componentHub, pageContext)
        {
            var applicationContext = pageContext?.ApplicationContext;
            var baseUri = RouteEndpoint.Combine(applicationContext?.Route, "webexpress.webapp/assets");

            Header.Fixed = TypeFixed.Top;
            Header.Styles = ["position: sticky; top: 0; z-index: 99;"];

            AddCssLink(Theme?.ThemeStyle.ToString() ?? RouteEndpoint.Combine(baseUri, "css/webexpress.webapp.theme.css"));
        }

        /// <summary>
        /// Convert to html.
        /// </summary>
        /// <param name="context">The context for rendering the page.</param>
        /// <returns>The page as an html tree.</returns>
        public override IHtmlNode Render(IVisualTreeContext context)
        {
            var html = new HtmlElementRootHtml();
            var renderContext = new RenderControlContext(context.RenderContext);

            // head
            html.Head.Title = I18N.Translate(context.Request, Title);
            html.Head.Favicons = Favicons;
            html.Head.Styles = Styles;
            html.Head.Meta = Meta;
            html.Head.Scripts = HeaderScripts;
            html.Head.CssLinks = CssLinks.Where(x => x is not null).Select(x => x.ToString());
            html.Head.ScriptLinks = HeaderScriptLinks?.Where(x => x is not null).Select(x => x.ToString());

            // body
            Header.AppTitle.SetTitle(html.Head.Title);
            if (Theme?.ThemeMode == ThemeMode.Dark)
            {
                html.Body.AddUserAttribute("data-bs-theme", "dark");
            }

            html.Body.Add(Header.Render(renderContext, this));
            html.Body.Add(Toast.Render(renderContext, this));

            // render centered content area without sidebar or breadcrumb
            var centeredContent = new ControlPanelCenter("wx-login-center",
                Content.MainPanel as IControl)
            {
                Fluid = TypePanelContainer.Default
            };

            html.Body.Add(centeredContent.Render(renderContext, this));
            html.Body.Add(NotificationPopup.Render(renderContext, this));

            html.Body.Scripts = [.. Scripts.Values];

            return html;
        }
    }
}
