using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the web app header settings control.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlWebAppHeaderSettings
    {
        /// <summary>
        /// Tests the id property of the web app header settings control. The request carries no
        /// identity, so the system category, whose pages all require system access, is not offered
        /// and the menu disappears once nothing else is left in it.
        /// </summary>
        [Theory]
        [InlineData(null, false, "<div class=\"wx-webui-dropdown wx-app-dropdown ms-2\" title=\"Settings\" data-icon=\"wx-icon-light wx-icon-light-cog\" data-menuCss=\"dropdown-menu-end\"><div class=\"wx-dropdown-header\" role=\"heading\">Settings</div><div class=\"wx-dropdown-item\"></div></div>")]
        [InlineData("id", false, "<div id=\"id\" class=\"wx-webui-dropdown wx-app-dropdown ms-2\" title=\"Settings\" data-icon=\"wx-icon-light wx-icon-light-cog\" data-menuCss=\"dropdown-menu-end\"><div class=\"wx-dropdown-header\" role=\"heading\">Settings</div><div class=\"wx-dropdown-item\"></div></div>")]
        [InlineData("id", true, null)]
        public void Id(string id, bool empty, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlWebAppHeaderSettings(id)
            {
            };

            if (!empty)
            {
                control.AddPrimary(new ControlDropdownItemLink());
            }

            // act
            var html = control.Render(context, visualTree);

            if (expected is null)
            {
                Assert.Null(html);
                return;
            }

            AssertExtensions.EqualWithPlaceholders(expected, html);
        }
    }
}
