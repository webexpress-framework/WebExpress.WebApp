using System;
using WebExpress.WebApp.WebPage;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebApplication;
using WebExpress.WebCore.WebPage;
using WebExpress.WebCore.WebStatusPage;
using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.WebStatusPage
{
    /// <summary>
    /// Base class for a WebApp status page: the page shown for an HTTP status (such as an error), rendered with the WebApp's visual tree.
    /// </summary>
    public abstract class PageStatusWebApp : IStatusPage<VisualTreeWebApp>
    {
        protected readonly IApplicationContext _applicationContext;
        protected readonly IStatusPageContext _statusPageContext;

        /// <summary>
        /// Gets the current status message of the operation.
        /// </summary>
        public string StatusMessage { get; protected set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="statusPageContext">The context of the status page.</param>
        /// <param name="statusMessage">The status message.</param>
        protected PageStatusWebApp(IStatusPageContext statusPageContext, StatusMessage statusMessage = null)
        {
            _statusPageContext = statusPageContext ??
                throw new ArgumentNullException(nameof(statusPageContext), "Parameter cannot be null or empty.");

            StatusMessage = statusMessage?.Message;
        }

        /// <summary>
        /// Processing of the status page.
        /// </summary>
        /// <param name="renderContext">The context for rendering the status page.</param>
        /// <param name="visualTree">The visual tree to be rendered.</param>
        public void Process(IRenderContext renderContext, VisualTreeWebApp visualTree)
        {
            var statusCode = new ControlText()
            {
                Text = _ => _statusPageContext.StatusCode.ToString(),
                Format = _ => TypeFormatText.H2,
                Margin = _ => new PropertySpacingMargin(PropertySpacing.Space.One),
                Padding = _ => new PropertySpacingPadding(PropertySpacing.Space.Four)
            };

            var title = new ControlText()
            {
                Text = _ => I18N.Translate(renderContext, _statusPageContext.StatusTitle),
                Format = _ => TypeFormatText.H3,
                Margin = _ => new PropertySpacingMargin(PropertySpacing.Space.Two, PropertySpacing.Space.Three)
            };

            var description = new ControlText()
            {
                Text = _ => I18N.Translate(renderContext, _statusPageContext.StatusDescription),
                Format = _ => TypeFormatText.Markdown,
                Margin = _ => new PropertySpacingMargin(PropertySpacing.Space.Two, PropertySpacing.Space.Three)
            };

            var message = new ControlPanelCard()
            {
                BackgroundColor = _ => new PropertyColorBackground(TypeColorBackground.Light)
            }
                .Add(new ControlText()
                {
                    Text = _ => StatusMessage,
                    Margin = _ => new PropertySpacingMargin(PropertySpacing.Space.Two, PropertySpacing.Space.Three)
                });

            var panel = new ControlPanel()
            {
                Margin = _ => new PropertySpacingMargin(PropertySpacing.Space.Three)
            }
                .Add(title, description, !string.IsNullOrWhiteSpace(StatusMessage) ? message : null);

            var flex = new ControlPanelFlex()
            {
                Layout = _ => TypeLayoutFlex.Inline,
                Justify = _ => TypeJustifiedFlex.Start,
                Align = _ => TypeAlignFlex.Stretch
            }
                .Add(statusCode, panel);

            visualTree.Title = I18N.Translate(renderContext, renderContext.PageContext.ApplicationContext?.ApplicationName);
            visualTree.Content.MainPanel.AddPrimary(flex);
        }
    }
}
