using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebCore.WebSettingPage;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the setting tab control.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlWebAppSettingTab
    {
        /// <summary>
        /// Tests that the category band carries the authored layout, with the tab
        /// layout as the default the settings shell has always rendered.
        /// </summary>
        [Theory]
        [InlineData(null, @"<ul id=""id"" class=""nav nav-tabs"">*</ul>")]
        [InlineData(TypeLayoutTab.Underline, @"<ul id=""id"" class=""nav nav-underline"">*</ul>")]
        [InlineData(TypeLayoutTab.Pill, @"<ul id=""id"" class=""nav nav-pills"">*</ul>")]
        public void Layout(TypeLayoutTab? layout, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();

            // the control marks the open category against the page it renders on, so
            // the page has to be one of the settings shell rather than a plain page
            var context = new RenderControlContext(null, new SettingPageContext(), UnitTestControlFixture.CreateRequestMock());
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlWebAppSettingTab("id");

            if (layout.HasValue)
            {
                control.Layout = _ => layout.Value;
            }

            // the band renders only where there is something to navigate between
            control.AddPreferences
            (
                new ControlNavigationItemLink() { Text = _ => "A" },
                new ControlNavigationItemLink() { Text = _ => "B" }
            );

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }
    }
}
