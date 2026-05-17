using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the web app header avatar control.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlWebAppHeaderAvatar
    {
        /// <summary>
        /// Tests the id property of the web app header avatar control.
        /// </summary>
        [Theory]
        [InlineData(null, false, "<div class=\"wx-webui-avatar-dropdown ms-2\" role=\"button\" data-menuCss=\"dropdown-menu-end\"><div class=\"wx-dropdown-header\" role=\"heading\">User</div><div class=\"wx-dropdown-item\"></div></div>")]
        [InlineData("id", false, "<div id=\"id\" class=\"wx-webui-avatar-dropdown ms-2\" role=\"button\" data-menuCss=\"dropdown-menu-end\"><div class=\"wx-dropdown-header\" role=\"heading\">User</div><div class=\"wx-dropdown-item\"></div></div>")]
        [InlineData("id", true, "")]
        public void Id(string id, bool empty, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlWebAppHeaderAvatar(id)
            {
            };

            if (!empty)
            {
                control.AddPrimary(new ControlDropdownItemLink());
            }

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the username property of the web app header avatar control.
        /// </summary>
        [Theory]
        [InlineData(null, "<div id=\"id\" class=\"wx-webui-avatar-dropdown ms-2\" role=\"button\" data-menuCss=\"dropdown-menu-end\"><div class=\"wx-dropdown-header\" role=\"heading\">User</div><div class=\"wx-dropdown-item\"></div></div>")]
        [InlineData("bob", "<div id=\"id\" class=\"wx-webui-avatar-dropdown ms-2\" role=\"button\" data-name=\"bob\" data-menuCss=\"dropdown-menu-end\"><div class=\"wx-dropdown-header\" role=\"heading\">User</div><div class=\"wx-dropdown-item\"></div></div>")]
        public void Username(string username, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlWebAppHeaderAvatar("id")
            {
                Username = username
            };

            control.AddPrimary(new ControlDropdownItemLink());

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the Iamge property of the web app header avatar control.
        /// </summary>
        [Theory]
        [InlineData(null, "<div id=\"id\" class=\"wx-webui-avatar-dropdown ms-2\" role=\"button\" data-src=\"/\" data-menuCss=\"dropdown-menu-end\"><div class=\"wx-dropdown-header\" role=\"heading\">User</div><div class=\"wx-dropdown-item\"></div></div>")]
        [InlineData("/abc.svg", "<div id=\"id\" class=\"wx-webui-avatar-dropdown ms-2\" role=\"button\" data-src=\"/abc.svg\" data-menuCss=\"dropdown-menu-end\"><div class=\"wx-dropdown-header\" role=\"heading\">User</div><div class=\"wx-dropdown-item\"></div></div>")]
        public void Iamge(string image, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlWebAppHeaderAvatar("id")
            {
                Image = new UriEndpoint(image)
            };

            control.AddPrimary(new ControlDropdownItemLink());

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests that the control renders as a ControlAvatarDropdown with the wx-webapp-avatar-dropdown class.
        /// </summary>
        [Fact]
        public void RendersAsAvatarDropdown()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlWebAppHeaderAvatar("id")
            {
            };

            control.AddPrimary(new ControlDropdownItemLink());

            // act
            var html = control.Render(context, visualTree);

            // validation - verify the avatar dropdown class is present
            AssertExtensions.EqualWithPlaceholders
            (
                "<div id=\"id\" class=\"wx-webui-avatar-dropdown ms-2\" role=\"button\" data-menuCss=\"dropdown-menu-end\"><div class=\"wx-dropdown-header\" role=\"heading\">User</div><div class=\"wx-dropdown-item\"></div></div>",
                html
            );
        }

        /// <summary>
        /// Tests that the control returns null when no items are available.
        /// </summary>
        [Fact]
        public void EmptyReturnsNull()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlWebAppHeaderAvatar("id")
            {
            };

            // act
            var html = control.Render(context, visualTree);

            // validation - the control renders with the settings from SettingPageManager
            Assert.Null(html);
        }
    }
}
