using WebExpress.WebCore.WebHtml;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebApiControl
{
    /// <summary>
    /// Represents a REST-enabled password input control that extends the base 
    /// <see cref="ControlFormItemInputPassword"/> from WebUI.
    /// </summary>
    public class ControlRestFormItemInputPassword : ControlFormItemInputPassword
    {
        /// <summary>
        /// Initializes a new instance of the class with an automatically assigned ID.
        /// </summary>
        public ControlRestFormItemInputPassword()
            : this(DeterministicId.Create())
        {
        }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlRestFormItemInputPassword(string id)
            : base(id)
        {
        }

        /// <summary>
        /// Converts the control to an HTML representation.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <param name="visualTree">The visual tree representing the control's structure.</param>
        /// <returns>An HTML node representing the rendered control.</returns>
        public override IHtmlNode Render(IRenderControlFormContext renderContext, IVisualTreeControl visualTree)
        {
            var html = base.Render(renderContext, visualTree)
                .AddClass("wx-webapp-input-password")
                .RemoveClass("wx-webui-input-password");

            return html;
        }
    }
}
