using System;
using WebExpress.WebCore;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebPage;
using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.WebPage
{
    /// <summary>
    /// Represents a logout page for the web application.
    /// Terminates the current authenticated session and presents a confirmation message
    /// with a navigation link back to the login page.
    /// </summary>
    public class PageWebAppLogout : IPage<VisualTreeWebAppLogin>
    {
        /// <summary>
        /// Processing of the page.
        /// Performs the logout operation and renders a confirmation message.
        /// </summary>
        /// <param name="renderContext">The context for rendering the page.</param>
        /// <param name="visualTree">The visual tree control to be processed.</param>
        public void Process(IRenderContext renderContext, VisualTreeWebAppLogin visualTree)
        {
            if (renderContext is null)
            {
                throw new ArgumentNullException(nameof(renderContext), "Parameter cannot be null or empty.");
            }

            if (visualTree is null)
            {
                throw new ArgumentNullException(nameof(visualTree), "Parameter cannot be null or empty.");
            }

            // terminate the authenticated session
            WebEx.ComponentHub.IdentityManager.Logout(renderContext.Request);

            var title = new ControlText()
            {
                Text = I18N.Translate(renderContext, "webexpress.webapp:logout.title"),
                Format = TypeFormatText.H2,
                Margin = new PropertySpacingMargin(PropertySpacing.Space.Two, PropertySpacing.Space.Three)
            };

            var message = new ControlText()
            {
                Text = I18N.Translate(renderContext, "webexpress.webapp:logout.description"),
                Format = TypeFormatText.Paragraph,
                Margin = new PropertySpacingMargin(PropertySpacing.Space.Two, PropertySpacing.Space.Three)
            };

            var loginUri = WebEx.ComponentHub.SitemapManager.GetUri<PageWebAppLogin>(renderContext.PageContext?.ApplicationContext);

            var loginLink = new ControlLink()
            {
                Text = I18N.Translate(renderContext, "webexpress.webapp:logout.login.label"),
                Uri = loginUri
            };

            var card = new ControlPanelCard("wx-logout-card", title, message, loginLink)
            {
                Margin = new PropertySpacingMargin(PropertySpacing.Space.Three)
            };

            visualTree.Title = I18N.Translate(renderContext, "webexpress.webapp:logout.title");
            visualTree.Content.MainPanel.AddPrimary(card);
        }
    }
}
