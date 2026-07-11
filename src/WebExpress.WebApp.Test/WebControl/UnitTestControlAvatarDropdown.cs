using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebApiControl;
using WebExpress.WebApp.WebControl;
using WebExpress.WebApp.WebData;
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
            var control = new ControlDataAvatarDropdown(id)
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
        [InlineData("https://example.com/api/avatar", @"<div class=""wx-webapp-avatar-dropdown"" role=""button""><wx-service hidden name=""data"" kind=""rest"" base-uri=""https://example.com/api/avatar"" method=""GET""></wx-service></div>")]
        public void RestUri(string uriString, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataAvatarDropdown()
            {
                ServiceFactory = uriString is not null ? _ => DataServiceDescriptor.QueryData(uriString) : null
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// When bound to a ViewState resource, the control emits only the
        /// <c>data-wx-resource</c> binding and skips its own <c>wx-service</c>
        /// island, because the enclosing ViewState owns the service and the central load.
        /// </summary>
        [Fact]
        public void ViewStateBound_EmitsResourceBinding_NotService()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataAvatarDropdown()
            {
                // even with a service declared, the resource binding wins
                ServiceFactory = _ => DataServiceDescriptor.QueryData("https://example.com/api/avatar"),
                ResourceFactory = _ => "avatar"
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(@"<div class=""wx-webapp-avatar-dropdown"" role=""button"" data-wx-resource=""avatar""></div>", html);
        }

        /// <summary>
        /// The fluent <c>Resource&lt;TResource&gt;()</c> binding sets the resource factory to the
        /// resource type name and preserves the concrete control type for chaining.
        /// </summary>
        [Fact]
        public void Resource_BindsByType_PreservingConcreteType()
        {
            // arrange & act: the assignment compiles only because the typed overload returns the
            // concrete control type rather than IViewStateBound
            ControlDataAvatarDropdown control = new ControlDataAvatarDropdown("avatar").Resource<AvatarTestResource>();

            // validation
            Assert.Equal(DataTypeName.Of<AvatarTestResource>(), control.ResourceFactory(null));
        }

        /// <summary>
        /// A resource identity used only by the binding test.
        /// </summary>
        private sealed class AvatarTestResource : IDataResource
        {
        }
    }
}
