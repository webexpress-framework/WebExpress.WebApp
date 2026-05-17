using WebExpress.WebCore.WebHtml;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Renders the host element for the popup notification overlay. The
    /// actual notifications are delivered live by the server through the
    /// MessageQueue WebSocket.
    /// </summary>
    public class ControlPopupNotification : Control
    {
        /// <summary>
        /// Initializes a new instance of the
        /// <see cref="ControlPopupNotification"/> class.
        /// </summary>
        /// <param name="id">
        /// The optional identifier for the control.
        /// </param>
        public ControlPopupNotification(string id = null)
            : base(id ?? "26E517F5-56F7-485E-A212-6033618708F3")
        {
        }

        /// <summary>
        /// Converts the control to an HTML representation.
        /// </summary>
        /// <param name="renderContext">The render context.</param>
        /// <param name="visualTree">The visual tree.</param>
        /// <returns>The rendered HTML node.</returns>
        public override IHtmlNode Render(IRenderControlContext renderContext, IVisualTreeControl visualTree)
        {
            return new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-popupnotification", GetClasses()),
                Style = GetStyles()
            };
        }
    }
}
