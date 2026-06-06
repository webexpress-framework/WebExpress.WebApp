using System;
using WebExpress.WebApp.WebControl;
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
    public class ControlDataLogin : ControlLogin, IControlData
    {
        /// <summary>
        /// Gets or sets the REST API endpoint used for login authentication.
        /// </summary>
        public Func<IRenderControlContext, IUri> RestUri { get; set; }

        /// <summary>
        /// Gets or sets the URI to redirect to after a successful login.
        /// </summary>
        public Func<IRenderControlContext, IUri> RedirectUri { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlDataLogin(string id = null)
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
            var uri = RestUri?.Invoke(renderContext);
            var redirectUri = RedirectUri?.Invoke(renderContext);

            var resultUri = uri?.BindParameters(renderContext?.Request);

            var html = base.Render(renderContext, visualTree)
                .AddClass("wx-webapp-login")
                .RemoveClass("wx-webui-login")
                .AddUserAttribute("data-uri", resultUri?.ToString())
                .AddUserAttribute("data-redirect", redirectUri?.ToString());

            return html;
        }
    }
}
