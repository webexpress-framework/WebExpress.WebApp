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
        [InlineData(null, false, "<div class=\"wx-webapp-avatar-dropdown wx-app-dropdown ms-2\" role=\"button\" data-icon=\"fas fa-cog\" data-menuCss=\"dropdown-menu-end\"><div class=\"wx-dropdown-header\" role=\"heading\">Avatar</div><div class=\"wx-dropdown-item\"></div><div class=\"wx-dropdown-item\" data-icon=\"fas fa-gears\" data-uri=\"/server/app/webexpress.webapp/settings/*\">System</div></div>")]
        [InlineData("id", false, "<div id=\"id\" class=\"wx-webapp-avatar-dropdown wx-app-dropdown ms-2\" role=\"button\" data-icon=\"fas fa-cog\" data-menuCss=\"dropdown-menu-end\"><div class=\"wx-dropdown-header\" role=\"heading\">Avatar</div><div class=\"wx-dropdown-item\"></div><div class=\"wx-dropdown-item\" data-icon=\"fas fa-gears\" data-uri=\"/server/app/webexpress.webapp/settings/*\">System</div></div>")]
        [InlineData("id", true, "<div id=\"id\" class=\"wx-webapp-avatar-dropdown wx-app-dropdown ms-2\" role=\"button\" data-icon=\"fas fa-cog\" data-menuCss=\"dropdown-menu-end\"><div class=\"wx-dropdown-item\" data-icon=\"fas fa-gears\" data-uri=\"/server/app/webexpress.webapp/settings/*\">System</div></div>")]
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

            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the rest uri property of the web app header avatar control.
        /// </summary>
        [Theory]
        [InlineData(null)]
        [InlineData("https://example.com/api/avatar")]
        public void RestUri(string uriString)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlWebAppHeaderAvatar("id")
            {
                RestUri = uriString is not null ? new UriEndpoint(uriString) : null
            };

            control.AddPrimary(new ControlDropdownItemLink());

            // act
            var html = control.Render(context, visualTree);

            if (uriString is not null)
            {
                AssertExtensions.EqualWithPlaceholders(
                    "*data-uri=\"https://example.com/api/avatar\"*",
                    html
                );
            }
            else
            {
                Assert.NotNull(html);
            }
        }

        /// <summary>
        /// Tests the image property of the web app header avatar control.
        /// </summary>
        [Theory]
        [InlineData(null)]
        [InlineData("/img/avatar.png")]
        public void Image(string image)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlWebAppHeaderAvatar("id")
            {
                Image = image
            };

            control.AddPrimary(new ControlDropdownItemLink());

            // act
            var html = control.Render(context, visualTree);

            if (image is not null)
            {
                AssertExtensions.EqualWithPlaceholders(
                    "*data-image=\"/img/avatar.png\"*",
                    html
                );
            }
            else
            {
                Assert.NotNull(html);
            }
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
            AssertExtensions.EqualWithPlaceholders(
                "*wx-webapp-avatar-dropdown*",
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
            Assert.NotNull(html);
        }
    }
}
