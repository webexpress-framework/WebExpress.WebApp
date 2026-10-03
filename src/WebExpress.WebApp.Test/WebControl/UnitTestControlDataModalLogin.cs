using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebApp.WebData;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the REST login dialog: the login dialog of WebUI framing the REST login
    /// form, whose service and redirect are emitted on the framed login's host.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlDataModalLogin
    {
        /// <summary>
        /// Tests that the dialog frames the REST login, marked for the REST login
        /// controller, and derives its id from the dialog.
        /// </summary>
        [Theory]
        [InlineData(null, @"<dialog class=""wx-webui-modal-login"" data-close-label=""Close""><div class=""wx-modal-header"">Login</div><div class=""wx-modal-content""><div class=""wx-webapp-login""></div></div><div class=""wx-modal-footer""></div></dialog>")]
        [InlineData("signin", @"<dialog id=""signin"" class=""wx-webui-modal-login"" data-close-label=""Close""><div class=""wx-modal-header"">Login</div><div class=""wx-modal-content""><div id=""signin_login"" class=""wx-webapp-login""></div></div><div class=""wx-modal-footer""></div></dialog>")]
        public void Id(string id, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataModalLogin(id);

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests that the service declared on the dialog is emitted on the framed
        /// login, where the REST login controller reads it.
        /// </summary>
        [Theory]
        [InlineData(null, @"<dialog class=""wx-webui-modal-login"" *><div class=""wx-modal-content""><div class=""wx-webapp-login""></div></div>*</dialog>")]
        [InlineData("https://example.com/api/session", @"<dialog class=""wx-webui-modal-login"" *><div class=""wx-modal-content""><div class=""wx-webapp-login""><wx-service hidden name=""data"" kind=""rest"" base-uri=""https://example.com/api/session"" method=""POST""></wx-service></div></div>*</dialog>")]
        public void Service(string uriString, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataModalLogin(null)
            {
                ServiceFactory = uriString is not null ? _ => DataServiceDescriptor.SubmitData(uriString) : null
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests that the redirect and the username reach the framed login.
        /// </summary>
        [Fact]
        public void RedirectUriAndUsername_ReachTheFramedLogin()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataModalLogin(null)
            {
                Username = _ => "guybrush",
                RedirectUri = _ => new UriEndpoint("https://example.com/home")
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(
                @"<dialog class=""wx-webui-modal-login"" *><div class=""wx-modal-content""><div class=""wx-webapp-login"" data-username=""guybrush"" data-redirect=""https://example.com/home""></div></div>*</dialog>",
                html);
        }
    }
}
