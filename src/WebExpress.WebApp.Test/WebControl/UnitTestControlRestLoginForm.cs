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
        [InlineData(null, @"<div class=""wx-webapp-loginform""></div>")]
        [InlineData("login-form", @"<div id=""login-form"" class=""wx-webapp-loginform""></div>")]
        public void Id(string id, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestLoginForm(id);

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the REST URI property of the login form control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-loginform""></div>")]
        [InlineData("https://example.com/api/login", @"<div class=""wx-webapp-loginform"" data-uri=""https://example.com/api/login""></div>")]
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
        [InlineData(null, @"<div class=""wx-webapp-loginform""></div>")]
        [InlineData("https://example.com/home", @"<div class=""wx-webapp-loginform"" data-redirect=""https://example.com/home""></div>")]
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

        /// <summary>
        /// Tests that the Title property from the base ControlLogin is accessible.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-loginform""></div>")]
        [InlineData("My Login", @"<div class=""wx-webapp-loginform"" dataset-title=""My Login""></div>")]
        public void Title(string title, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestLoginForm()
            {
                Title = title
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }
    }
}
