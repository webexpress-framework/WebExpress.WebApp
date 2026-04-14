using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebApiControl;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the avatar dropdown control.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlAvatarDropdown
    {
        /// <summary>
        /// Tests the id property of the avatar dropdown control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-avatar-dropdown"" role=""button""></div>")]
        [InlineData("id", @"<div id=""id"" class=""wx-webapp-avatar-dropdown"" role=""button""></div>")]
        public void Id(string id, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestAvatarDropdown(id)
            {
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the rest uri property of the avatar dropdown control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-avatar-dropdown"" role=""button""></div>")]
        [InlineData("https://example.com/api/avatar", @"<div class=""wx-webapp-avatar-dropdown"" role=""button"" data-uri=""https://example.com/api/avatar""></div>")]
        public void RestUri(string uriString, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestAvatarDropdown()
            {
                RestUri = uriString is not null ? new UriEndpoint(uriString) : null
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }
    }
}
