using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebApiControl;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the REST login form control.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlRestLoginForm
    {
        /// <summary>
        /// Tests the id property of the login form control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<form id=""*"" class=""wx-webapp-loginform"" data-username-label=""Username"" data-username-placeholder=""Enter your username"" data-password-label=""Password"" data-password-placeholder=""Enter your password"" data-submit-label=""Sign in""></form>")]
        [InlineData("login-form", @"<form id=""login-form"" class=""wx-webapp-loginform"" data-username-label=""Username"" data-username-placeholder=""Enter your username"" data-password-label=""Password"" data-password-placeholder=""Enter your password"" data-submit-label=""Sign in""></form>")]
        public void Id(string id, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = id is not null
                ? new ControlRestLoginForm(id)
                : new ControlRestLoginForm();

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the REST URI property of the login form control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<form id=""*"" class=""wx-webapp-loginform"" data-username-label=""Username"" data-username-placeholder=""Enter your username"" data-password-label=""Password"" data-password-placeholder=""Enter your password"" data-submit-label=""Sign in""></form>")]
        [InlineData("https://example.com/api/login", @"<form id=""*"" class=""wx-webapp-loginform"" data-uri=""https://example.com/api/login"" data-username-label=""Username"" data-username-placeholder=""Enter your username"" data-password-label=""Password"" data-password-placeholder=""Enter your password"" data-submit-label=""Sign in""></form>")]
        public void RestUri(string uriString, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestLoginForm()
            {
                RestUri = uriString is not null ? new UriEndpoint(uriString) : null
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the redirect URI property of the login form control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<form id=""*"" class=""wx-webapp-loginform"" data-username-label=""Username"" data-username-placeholder=""Enter your username"" data-password-label=""Password"" data-password-placeholder=""Enter your password"" data-submit-label=""Sign in""></form>")]
        [InlineData("https://example.com/home", @"<form id=""*"" class=""wx-webapp-loginform"" data-redirect=""https://example.com/home"" data-username-label=""Username"" data-username-placeholder=""Enter your username"" data-password-label=""Password"" data-password-placeholder=""Enter your password"" data-submit-label=""Sign in""></form>")]
        public void RedirectUri(string uriString, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestLoginForm()
            {
                RedirectUri = uriString is not null ? new UriEndpoint(uriString) : null
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }
    }
}
