using System;
using WebExpress.WebCore;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebPage;
using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.WebPage
{
    /// <summary>
    /// Represents an access-denied page for the web application.
    /// Shown when an authenticated user attempts to access a resource for which
    /// they do not have sufficient permissions.
    /// </summary>
    public class PageWebAppForbidden : IPage<VisualTreeWebApp>
    {
        /// <summary>
        /// Processing of the page.
        /// Renders an access-denied message with a link to switch accounts or return to login.
        /// </summary>
        /// <param name="renderContext">The context for rendering the page.</param>
        /// <param name="visualTree">The visual tree control to be processed.</param>
        public virtual void Process(IRenderContext renderContext, VisualTreeWebApp visualTree)
        {
            if (renderContext is null)
            {
                throw new ArgumentNullException(nameof(renderContext), "Parameter cannot be null or empty.");
            }

            if (visualTree is null)
            {
                throw new ArgumentNullException(nameof(visualTree), "Parameter cannot be null or empty.");
            }

            var title = new ControlText()
            {
                Text = I18N.Translate(renderContext, "webexpress.webapp:forbidden.title"),
                Format = TypeFormatText.H2,
                Margin = new PropertySpacingMargin(PropertySpacing.Space.Two, PropertySpacing.Space.Three)
            };

            var description = new ControlText()
            {
                Text = I18N.Translate(renderContext, "webexpress.webapp:forbidden.description"),
                Format = TypeFormatText.Paragraph,
                Margin = new PropertySpacingMargin(PropertySpacing.Space.Two, PropertySpacing.Space.Three)
            };

            var loginUri = WebEx.ComponentHub.SitemapManager.GetUri<PageWebAppLogin>(renderContext.PageContext?.ApplicationContext);

            var switchAccountLink = new ControlLink()
            {
                Text = I18N.Translate(renderContext, "webexpress.webapp:forbidden.switchaccount.label"),
                Uri = loginUri
            };

            var card = new ControlPanelCard("wx-forbidden-card", title, description, switchAccountLink)
            {
                Margin = new PropertySpacingMargin(PropertySpacing.Space.Three)
            };

            visualTree.Title = I18N.Translate(renderContext, "webexpress.webapp:forbidden.title");
            visualTree.Content.MainPanel.AddPrimary(card);
        }
    }
}
