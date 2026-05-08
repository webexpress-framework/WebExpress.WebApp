using System;
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
                Text = _ => I18N.Translate(renderContext, "webexpress.webapp:forbidden.title"),
                Format = _ => TypeFormatText.H2,
                Margin = _ => new PropertySpacingMargin(PropertySpacing.Space.Two, PropertySpacing.Space.Three)
            };

            var description = new ControlText()
            {
                Text = _ => I18N.Translate(renderContext, "webexpress.webapp:forbidden.description"),
                Format = _ => TypeFormatText.Paragraph,
                Margin = _ => new PropertySpacingMargin(PropertySpacing.Space.Two, PropertySpacing.Space.Three)
            };

            var image = new ControlImage()
            {
                Uri = _ => renderContext.PageContext.ApplicationContext?.Route.Concat("webexpress.webapp/assets/img/forbidden.svg").ToUri(),
                Width = _ => 96,
                Height = _ => 96,
                Margin = _ => new PropertySpacingMargin(PropertySpacing.Space.Two)
            };

            var left = new ControlPanel()
            {
                Margin = _ => new PropertySpacingMargin(PropertySpacing.Space.Two)
            }
                .Add(image);

            var right = new ControlPanel()
            {
                Margin = _ => new PropertySpacingMargin(PropertySpacing.Space.Two)
            }
                .Add(title)
                .Add(description);

            var flex = new ControlPanelFlex()
            {
                Display = _ => TypeDisplay.Flex,
                Direction = _ => TypeDirection.Horizontal,
                Justify = _ => TypeJustifiedFlex.Start,
                Align = _ => TypeAlignFlex.Start,
                Gap = _ => TypeGap.Three
            };

            flex.Add(left);
            flex.Add(right);

            var card = new ControlPanelCard("wx-forbidden-card", flex)
            {
                Margin = _ => new PropertySpacingMargin(PropertySpacing.Space.Three)
            };

            visualTree.Title = I18N.Translate(renderContext, "webexpress.webapp:forbidden.title");
            visualTree.Content.MainPanel.AddPrimary(card);
        }
    }
}
