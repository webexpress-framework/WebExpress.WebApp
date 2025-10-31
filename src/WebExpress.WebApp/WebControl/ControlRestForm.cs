using WebExpress.WebCore.WebHtml;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents a form control that renders as a hidden HTML element in the visual tree.
    /// </summary>
    public class ControlRestForm : ControlForm
    {
        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        public ControlRestForm()
        {
        }

        /// <summary>
        /// Initializes a new instance of the class with the specified identifier.
        /// </summary>
        /// <param name="id">The unique identifier for the control rest form.</param>
        public ControlRestForm(string id)
            : base(id)
        {
        }

        /// <summary>
        /// Convert to html.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <param name="visualTree">The visual tree representing the control's structure.</param>
        /// <returns>The control as html.</returns>
        public override IHtmlNode Render(IRenderControlContext renderContext, IVisualTreeControl visualTree)
        {
            var html = base.Render(renderContext, visualTree);

            return new HtmlElementTextContentDiv(html)
            {
                Class = "d-none"
            };
        }
    }
}
