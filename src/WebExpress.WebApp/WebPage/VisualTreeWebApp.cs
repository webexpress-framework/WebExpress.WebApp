using System;
using System.Collections.Generic;
using System.Linq;
using WebExpress.WebApp.WebControl;
using WebExpress.WebApp.WebSection;
using WebExpress.WebCore;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebComponent;
using WebExpress.WebCore.WebEndpoint;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebPage;
using WebExpress.WebCore.WebTheme;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebFragment;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebPage
{
    /// <summary>
    /// Represents the visual tree of the web application.
    /// </summary>
    public class VisualTreeWebApp : VisualTreeControl, IVisualTreeWebApp
    {
        /// <summary>
        /// Returns or sets the theme of the web application.
        /// </summary>
        public IThemeContext Theme { get; set; }

        /// <summary>
        /// Returns the HTML element that contains the URI of the message queue used by the application.
        /// </summary>
        public HtmlElementTextContentDiv MessageQueueUri { get; } = new HtmlElementTextContentDiv()
        {
            Id = "webepress-webapp-message-queue"
        };

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
        /// </summary>
        public ControlBreadcrumb Breadcrumb { get; protected set; } = new ControlBreadcrumb("wx-breadcrumb");

        /// <summary>
        /// Returns the area for prologue.
        /// </summary>
        public ControlWebAppPrologue Prologue { get; protected set; } = new ControlWebAppPrologue("wx-prologue");

        /// <summary>
        /// Returns the sidebar control.
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
        /// the current context.
        /// </summary>
        public Func<IEnumerable<string>> Domains { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="componentHub">The component hub.</param>
        /// <param name="pageContext">The page context.</param>
        public VisualTreeWebApp(IComponentHub componentHub, IPageContext pageContext)
            : base(componentHub, pageContext)
        {
            var applicationContext = pageContext?.ApplicationContext;
            var baseUri = RouteEndpoint.Combine(applicationContext?.Route, "webexpress.webapp/assets");
            var messageQueueUri = componentHub.SitemapManager
                .GetUri<WWW.Ws.MessageQueue>(pageContext.ApplicationContext);
            var domains = Domains?.Invoke() ?? pageContext.Domains.Select(x => x.FullName.ToLower());

            MessageQueueUri
                .AddUserAttribute("data-wx-message-queue-url", messageQueueUri?.ToString())
                .AddUserAttribute("data-wx-domains", string.Join(";", domains));

            Header.Fixed = TypeFixed.Top;
            Header.Styles = ["position: sticky; top: 0; z-index: 99;"];

            Breadcrumb.Uri = pageContext?.Route?.ToUri();
            Breadcrumb.Margin = new PropertySpacingMargin(PropertySpacing.Space.Null);
            (Content as ControlWebAppContent).Margin = new PropertySpacingMargin(PropertySpacing.Space.Two, PropertySpacing.Space.None, PropertySpacing.Space.None, PropertySpacing.Space.None);

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
            var body = new HtmlElementSectionBody();
            var renderContext = new RenderControlContext(context.RenderContext);

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

            var preferences = WebEx.ComponentHub.FragmentManager.GetFragments<IFragmentControl, SectionBodyPreferences>
            (
                renderContext?.PageContext
            );
            html.Body.Add(preferences.Select(x => x.Render(renderContext, this)));
            html.Body.Add(MessageQueueUri);
            html.Body.Add(Header.Render(renderContext, this));
            html.Body.Add(Toast.Render(renderContext, this));
            html.Body.Add(Breadcrumb.Render(renderContext, this, context.Request.Uri));
            html.Body.Add(Prologue.Render(renderContext, this));

            var primary = WebEx.ComponentHub.FragmentManager.GetFragments<IFragmentControl, SectionBodyPrimary>
            (
                renderContext?.PageContext
            );
            html.Body.Add(primary.Select(x => x.Render(renderContext, this)));

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
                SidePanelMinSize = 45
            };

            html.Body.Add
            (
                split.Render(renderContext, this)
                    .AddUserAttribute("data-wx-primary-action", "split")
                    .AddUserAttribute("data-wx-primary-target", $"#wx-split-button-toggle")
            );
            html.Body.Add(Footer.Render(renderContext, this));
            html.Body.Add(NotificationPopup.Render(renderContext, this));

            html.Body.Scripts = [.. Scripts.Values];

            var secondary = WebEx.ComponentHub.FragmentManager.GetFragments<IFragmentControl, SectionBodySecondary>
            (
                renderContext?.PageContext
            );

            html.Body.Add(secondary.Select(x => x.Render(renderContext, this)));

            return html;
        }
    }
}
