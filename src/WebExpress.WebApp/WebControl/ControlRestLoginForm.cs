using WebExpress.WebCore;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebApiControl
{
    /// <summary>
    /// Represents a REST-enabled login form that submits credentials
    /// to a REST API endpoint for authentication.
    /// </summary>
    public class ControlRestLoginForm : Control
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
        /// Gets or sets the label for the username field.
        /// </summary>
        public string UsernameLabel { get; set; } = "webexpress.webapp:login.username.label";

        /// <summary>
        /// Gets or sets the placeholder for the username field.
        /// </summary>
        public string UsernamePlaceholder { get; set; } = "webexpress.webapp:login.username.placeholder";

        /// <summary>
        /// Gets or sets the label for the password field.
        /// </summary>
        public string PasswordLabel { get; set; } = "webexpress.webapp:login.password.label";

        /// <summary>
        /// Gets or sets the placeholder for the password field.
        /// </summary>
        public string PasswordPlaceholder { get; set; } = "webexpress.webapp:login.password.placeholder";

        /// <summary>
        /// Gets or sets the label for the submit button.
        /// </summary>
        public string SubmitLabel { get; set; } = "webexpress.webapp:login.submit.label";

        /// <summary>
        /// Initializes a new instance of the class with an automatically assigned ID.
        /// </summary>
        public ControlRestLoginForm()
            : base(RandomId.Create())
        {
        }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlRestLoginForm(string id)
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
            var applicationContext = renderContext?.PageContext?.ApplicationContext;
            var resultUri = RestUri?.BindParameters(renderContext?.Request);

            var html = new HtmlElementFormForm()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-loginform", GetClasses()),
                Style = GetStyles()
            }
                .AddUserAttribute("data-uri", resultUri?.ToString())
                .AddUserAttribute("data-redirect", RedirectUri?.ToString())
                .AddUserAttribute("data-username-label", I18N.Translate(renderContext, UsernameLabel))
                .AddUserAttribute("data-username-placeholder", I18N.Translate(renderContext, UsernamePlaceholder))
                .AddUserAttribute("data-password-label", I18N.Translate(renderContext, PasswordLabel))
                .AddUserAttribute("data-password-placeholder", I18N.Translate(renderContext, PasswordPlaceholder))
                .AddUserAttribute("data-submit-label", I18N.Translate(renderContext, SubmitLabel));

            return html;
        }
    }
}
