using System;
using System.Collections.Generic;
using System.Linq;
using WebExpress.WebApp.WebApiControl;
using WebExpress.WebApp.WebControl;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebComponent;
using WebExpress.WebCore.WebEndpoint;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebIcon;
using WebExpress.WebCore.WebPage;
using WebExpress.WebCore.WebTheme;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebPage
{
    /// <summary>
    /// Represents the visual tree for login of the web application.
    /// </summary>
    public class VisualTreeWebAppLogin : VisualTreeControl, IVisualTreeWebApp
    {
        /// <summary>
        /// Gets or sets the URI used for breadcrumb navigation within the application.
        /// </summary>
        public IUri BreadcrumbUri { get; set; }

        /// <summary>
        /// Gets the HTML element that contains the URI of the message queue used by the application.
        /// </summary>
        public HtmlElementTextContentDiv MessageQueueUri { get; } = new HtmlElementTextContentDiv()
        {
            Id = "webepress-webapp-message-queue"
        };

        /// <summary>
        /// Gets header control.
        /// </summary>
        public ControlWebAppHeader Header { get; } = new ControlWebAppHeader("wx-header");

        /// <summary>
        /// Gets the area for the toast messages control.
        /// </summary>
        public ControlWebAppToastnotification Toast { get; protected set; } = new ControlWebAppToastnotification("wx-toast");

        /// <summary>
        /// Gets the range for the path specification.
        /// The login view does not show a breadcrumb, so this is always <c>null</c>.
        /// </summary>
        public ControlBreadcrumb Breadcrumb => null;

        /// <summary>
        /// Gets the area for prologue.
        /// The login view does not show a prologue, so this is always <c>null</c>.
        /// </summary>
        public ControlWebAppPrologue Prologue => null;

        /// <summary>
        /// Gets the sidebar control.
        /// The login view does not show a sidebar, so this is always <c>null</c>.
        /// </summary>
        public IControlWebAppSidebar Sidebar => null;

        /// <summary>
        /// Gets the content control.
        /// The login view renders its content directly in <see cref="Render"/>; this is always <c>null</c>.
        /// </summary>
        public new IControlWebAppContent Content => null;

        /// <summary>
        /// Gets the footer control.
        /// </summary>
        public IControlWebAppFooter Footer { get; protected set; } = new ControlWebAppFooter("wx-footer");

        /// <summary>
        /// Gets the control for displaying notification popups. Notifications
        /// are pushed live by the server through the MessageQueue WebSocket.
        /// </summary>
        public ControlPopupNotification NotificationPopup { get; protected set; } = new ControlPopupNotification("wx-notificationpopup");

        /// <summary>
        /// Gets or sets a delegate that returns the collection of domain names associated with 
        /// the current context.
        /// </summary>
        public Func<IEnumerable<string>> Domains { get; set; }

        /// <summary>
        /// Gets or sets the URI used for user login requests.
        /// </summary>
        public IUri LoginUri { get; set; }

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

            AddCssLink(Theme?.ThemeStyle?.ToString() ?? RouteEndpoint.Combine(baseUri, "css/webexpress.webapp.theme.css"));
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
            var login = new ControlDataLogin()
            {
                RestUri = _ => LoginUri,
                Padding = _ => new PropertySpacingPadding(PropertySpacing.Space.Five)
            };

            // head
            html.Head.Title = I18N.Translate(context.Request, Title);
            html.Head.Favicons = Favicons;
            html.Head.Base = Base?.ToString();
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
            if (IconTheme == TypeIconTheme.Light)
            {
                html.AddUserAttribute("data-icon-theme", "light");
            }
            html.Body.Add(MessageQueueUri);
            html.Body.Add(Header.Render(renderContext, this));
            html.Body.Add(Toast.Render(renderContext, this));
            html.Body.Add(new HtmlElementTextContentDiv(login.Render(renderContext, this))
            {
                Id = "login",
                Class = "d-flex h-100"
            });
            html.Body.Add(Footer.Render(renderContext, this));
            html.Body.Add(NotificationPopup.Render(renderContext, this));

            html.Body.Scripts = [.. Scripts.Values];

            return html;
        }
    }
}
