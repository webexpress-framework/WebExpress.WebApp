using WebExpress.WebApp.WWW.Api._1;
using WebExpress.WebCore;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents a control for displaying notification popups via API.
    /// </summary>
    public class ControlRestPopupNotification : Control
    {
        /// <summary>
        /// Initializes a new instance of the <see cref="ControlRestPopupNotification"/> class.
        /// </summary>
        /// <param name="id">The optional identifier for the control. If not provided, a new GUID will be generated.</param>
        public ControlRestPopupNotification(string id = null)
            : base(id ?? "26E517F5-56F7-485E-A212-6033618708F3")
        {
        }

        /// <summary>
        /// Converts the control to an HTML representation.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <param name="visualTree">The visual tree representing the control's structure.</param>
        /// <returns>An HTML node representing the rendered control.</returns>
        public override IHtmlNode Render(IRenderControlContext renderContext, IVisualTreeControl visualTree)
        {
            var applicationContext = renderContext?.PageContext?.ApplicationContext;

            var html = new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-popupnotification", GetClasses()),
                Style = GetStyles()
            }
                .AddUserAttribute("data-uri", WebEx.ComponentHub.SitemapManager.GetUri<RestPopupNotification>(applicationContext).ToString())
                .AddUserAttribute("data-intervall", "15000");

            return html;
        }
    }
}
