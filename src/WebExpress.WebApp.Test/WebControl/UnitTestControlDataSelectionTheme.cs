using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebData;
using WebExpress.WebApp.WebControl;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests <see cref="ControlDataSelectionTheme"/>: the dropdown shell
    /// should be promoted to the theme-specific JS class
    /// (<c>wx-webapp-dropdown-theme</c>) and the REST URI should arrive on
    /// the <c>data-uri</c> attribute so the JS layer can fetch the theme
    /// list and PUT the user's selection. No surrounding form is required.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlDataSelectionTheme
    {
        /// <summary>
        /// Without an explicit id the control auto-generates one and still
        /// emits the theme-specific class on the dropdown shell.
        /// </summary>
        [Fact]
        public void AutoId_RendersThemeClass()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataSelectionTheme();

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(
                @"<div class=""wx-webapp-dropdown-theme"" role=""button""></div>",
                html);
        }

        /// <summary>
        /// An explicit id surfaces verbatim on the dropdown shell.
        /// </summary>
        [Fact]
        public void ExplicitId_RendersOnHost()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataSelectionTheme("themePicker");

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(
                @"<div id=""themePicker"" class=""wx-webapp-dropdown-theme"" role=""button""></div>",
                html);
        }

        /// <summary>
        /// Tests that the service factory of the theme selection control emits the wx-service island.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div id=""themePicker"" class=""wx-webapp-dropdown-theme"" role=""button""></div>")]
        [InlineData("https://example.com/api/themes", @"<div id=""themePicker"" class=""wx-webapp-dropdown-theme"" role=""button""><wx-service hidden name=""data"" kind=""rest"" base-uri=""https://example.com/api/themes"" method=""GET"" update-method=""PUT""></wx-service></div>")]
        public void Service(string uri, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataSelectionTheme("themePicker")
            {
                ServiceFactory = uri is not null ? _ => DataServiceDescriptor.Data(uri) : null
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }
    }
}
