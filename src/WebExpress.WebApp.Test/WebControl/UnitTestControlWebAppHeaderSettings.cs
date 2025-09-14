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
        /// Tests the id property of the web app header settings control.
        /// </summary>
        [Theory]
        [InlineData(null, false, "<div class=\"wx-webui-dropdown ms-2\" role=\"button\" data-icon=\"fas fa-cog\" data-buttonCss=\"btn-dark\" data-menuCss=\"dropdown-menu-end\"><div id=\"Settings\" class=\"wx-dropdown-header\" role=\"heading\"></div><div class=\"wx-dropdown-item\"></div><div class=\"wx-dropdown-item\" data-icon=\"fas fa-gears\" data-uri=\"/server/app/webexpress.webapp/setting/system/log\">System</div></div>")]
        [InlineData("id", false, "<div id=\"id\" class=\"wx-webui-dropdown ms-2\" role=\"button\" data-icon=\"fas fa-cog\" data-buttonCss=\"btn-dark\" data-menuCss=\"dropdown-menu-end\"><div id=\"Settings\" class=\"wx-dropdown-header\" role=\"heading\"></div><div class=\"wx-dropdown-item\"></div><div class=\"wx-dropdown-item\" data-icon=\"fas fa-gears\" data-uri=\"/server/app/webexpress.webapp/setting/system/log\">System</div></div>")]
        [InlineData("id", true, "<div id=\"id\" class=\"wx-webui-dropdown ms-2\" role=\"button\" data-icon=\"fas fa-cog\" data-buttonCss=\"btn-dark\" data-menuCss=\"dropdown-menu-end\"><div class=\"wx-dropdown-item\" data-icon=\"fas fa-gears\" data-uri=\"/server/app/webexpress.webapp/setting/system/log\">System</div></div>")]
        public void Id(string id, bool empty, string expected)
        {
            // preconditions
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

            // test execution
            var html = control.Render(context, visualTree);

            AssertExtensions.EqualWithPlaceholders(expected, html);
        }
    }
}
