using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebApiControl
{
    /// <summary>
    /// Represents a REST-enabled login form that extends the base 
    /// <see cref="ControlLogin"/> from WebUI with REST API endpoint 
    /// configuration and redirect support.
    /// </summary>
    public class ControlRestLoginForm : ControlLogin
    {
        /// <summary>
        /// Gets or sets the REST API endpoint used for login authentication.
        /// </summary>
        public IUri RestUri { get; set; }

        /// <summary>
        /// Gets or sets the URI to redirect to after a successful login.
        /// </summary>
        public IUri RedirectUri { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlRestLoginForm(string id = null)
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
            var resultUri = RestUri?.BindParameters(renderContext?.Request);

            var html = base.Render(renderContext, visualTree)
                .AddClass("wx-webapp-loginform")
                .RemoveClass("wx-webui-login")
                .AddUserAttribute("data-uri", resultUri?.ToString())
                .AddUserAttribute("data-redirect", RedirectUri?.ToString());

            return html;
        }
    }
}
