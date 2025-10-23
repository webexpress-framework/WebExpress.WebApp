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
    /// A status page.
    /// </summary>
    public abstract class PageStatusWebApp : IStatusPage<VisualTreeWebApp>
    {
        protected readonly IApplicationContext _applicationContext;
        protected readonly IStatusPageContext _statusPageContext;

        /// <summary>
        /// Returns the current status message of the operation.
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
                Text = _statusPageContext.StatusCode.ToString(),
                Format = TypeFormatText.H2,
                Margin = new PropertySpacingMargin(PropertySpacing.Space.One),
                Padding = new PropertySpacingPadding(PropertySpacing.Space.Four)
            };

            var title = new ControlText()
            {
                Text = I18N.Translate(renderContext, _statusPageContext.StatusTitle),
                Format = TypeFormatText.H3,
                Margin = new PropertySpacingMargin(PropertySpacing.Space.Two, PropertySpacing.Space.Three)
            };

            var description = new ControlText()
            {
                Text = I18N.Translate(renderContext, _statusPageContext.StatusDescription),
                Format = TypeFormatText.Markdown,
                Margin = new PropertySpacingMargin(PropertySpacing.Space.Two, PropertySpacing.Space.Three)
            };

            var message = new ControlPanelCard()
            {
                BackgroundColor = new PropertyColorBackground(TypeColorBackground.Light)
            }
                .Add(new ControlText()
                {
                    Text = StatusMessage,
                    Margin = new PropertySpacingMargin(PropertySpacing.Space.Two, PropertySpacing.Space.Three)
                });

            var panel = new ControlPanel()
            {
                Margin = new PropertySpacingMargin(PropertySpacing.Space.Three)
            }
                .Add(title, description, !string.IsNullOrWhiteSpace(StatusMessage) ? message : null);

            var flex = new ControlPanelFlex()
            {
                Layout = TypeLayoutFlex.Inline,
                Justify = TypeJustifiedFlex.Start,
                Align = TypeAlignFlex.Stretch
            }
                .Add(statusCode, panel);

            visualTree.Title = I18N.Translate(renderContext, renderContext.PageContext.ApplicationContext?.ApplicationName);
            visualTree.Content.MainPanel.AddPrimary(flex);
        }
    }
}
