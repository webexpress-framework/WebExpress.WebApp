using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebApiControl
{
    /// <summary>
    /// Represents an avatar dropdown control that uses the avatar image as the interactive
    /// menu button and supports loading items dynamically via a REST API endpoint.
    /// </summary>
    public class ControlAvatarDropdown : ControlDropdown
    {
        /// <summary>
        /// Returns or sets the REST API endpoint used to populate the dropdown.
        /// </summary>
        public IUri RestUri { get; set; }

        /// <summary>
        /// Returns or sets the avatar image uri.
        /// </summary>
        public string Image { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlAvatarDropdown(string id = null)
            : base(id)
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
            var html = base.Render(renderContext, visualTree)
                .AddClass("wx-webapp-avatar-dropdown")
                .RemoveClass("wx-webui-dropdown")
                .AddUserAttribute("data-uri", RestUri?.ToString())
                .AddUserAttribute("data-image", I18N.Translate(renderContext, Image));

            return html;
        }
    }
}
