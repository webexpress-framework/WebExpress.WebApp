using System;
using System.Linq;
using System.Security;
using WebExpress.WebCore;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebPage;
using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.WebPage
{
    /// <summary>
    /// Represents a login page for the web application.
    /// Displays a username/password form and delegates authentication to the identity manager.
    /// </summary>
    public class PageWebAppLogin : IPage<VisualTreeWebAppLogin>
    {
        private readonly ControlFormItemInputText _usernameInput = new("wx-login-username")
        {
            Label = "webexpress.webapp:login.username.label",
            Placeholder = "webexpress.webapp:login.username.placeholder",
            Required = true
        };

        // note: the framework's ControlFormItemInputText renders as a plain text field.
        // password masking requires a password-capable control once available in the framework.
        private readonly ControlFormItemInputText _passwordInput = new("wx-login-password")
        {
            Label = "webexpress.webapp:login.password.label",
            Placeholder = "webexpress.webapp:login.password.placeholder",
            Required = true
        };

        private readonly ControlForm _loginForm = new("wx-login-form");

        /// <summary>
        /// Processing of the page.
        /// </summary>
        /// <param name="renderContext">The context for rendering the page.</param>
        /// <param name="visualTree">The visual tree control to be processed.</param>
        public void Process(IRenderContext renderContext, VisualTreeWebAppLogin visualTree)
        {
            if (renderContext is null)
            {
                throw new ArgumentNullException(nameof(renderContext), "Parameter cannot be null or empty.");
            }

            if (visualTree is null)
            {
                throw new ArgumentNullException(nameof(visualTree), "Parameter cannot be null or empty.");
            }

            var title = new ControlText()
            {
                Text = I18N.Translate(renderContext, "webexpress.webapp:login.title"),
                Format = TypeFormatText.H2,
                Margin = new PropertySpacingMargin(PropertySpacing.Space.Two, PropertySpacing.Space.Three)
            };

            _loginForm
                .Add(_usernameInput, _passwordInput)
                .AddPrimaryButton(new ControlFormItemButtonSubmit()
                {
                    Text = I18N.Translate(renderContext, "webexpress.webapp:login.submit.label"),
                    Color = new PropertyColorButton(TypeColorButton.Primary)
                })
                .Validate(e =>
                {
                    var username = e.Context.GetValue<ControlFormInputValueString>(_usernameInput)?.Text;
                    var password = e.Context.GetValue<ControlFormInputValueString>(_passwordInput)?.Text;

                    e.Add(string.IsNullOrWhiteSpace(username), "webexpress.webapp:login.error.empty", TypeInputValidity.Error);
                    e.Add(string.IsNullOrWhiteSpace(password), "webexpress.webapp:login.error.empty", TypeInputValidity.Error);
                })
                .Process(e =>
                {
                    var username = e.GetValue<ControlFormInputValueString>(_usernameInput)?.Text;
                    var password = e.GetValue<ControlFormInputValueString>(_passwordInput)?.Text;

                    // note: converting a plain string to SecureString is required by the IdentityManager.Login
                    // API even though the password is already in memory as a plain string at this point.
                    var securePassword = new SecureString();
                    foreach (var ch in password ?? string.Empty)
                    {
                        securePassword.AppendChar(ch);
                    }

                    var identity = WebEx.ComponentHub.IdentityManager.Identities
                        .FirstOrDefault(x => string.Equals(x.Name, username, StringComparison.OrdinalIgnoreCase));

                    WebEx.ComponentHub.IdentityManager.Login(renderContext.Request, identity, securePassword);
                });

            var card = new ControlPanelCard("wx-login-card", title, _loginForm)
            {
                Margin = new PropertySpacingMargin(PropertySpacing.Space.Three)
            };

            visualTree.Title = I18N.Translate(renderContext, "webexpress.webapp:login.title");
            visualTree.Content.MainPanel.AddPrimary(card);
        }
    }
}
