using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests <see cref="ControlRestSelectionTheme"/>: the dropdown shell
    /// should be promoted to the theme-specific JS class
    /// (<c>wx-webapp-dropdown-theme</c>) and the REST URI should arrive on
    /// the <c>data-uri</c> attribute so the JS layer can fetch the theme
    /// list and PUT the user's selection. No surrounding form is required.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlRestSelectionTheme
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
            var control = new ControlRestSelectionTheme();

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
            var control = new ControlRestSelectionTheme("themePicker");

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(
                @"<div id=""themePicker"" class=""wx-webapp-dropdown-theme"" role=""button""></div>",
                html);
        }

        /// <summary>
        /// The REST URI carried by <see cref="ControlRestSelectionTheme.RestUri"/>
        /// is emitted on <c>data-uri</c>.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div id=""themePicker"" class=""wx-webapp-dropdown-theme"" role=""button""></div>")]
        [InlineData("https://example.com/api/themes", @"<div id=""themePicker"" class=""wx-webapp-dropdown-theme"" role=""button"" data-uri=""https://example.com/api/themes""></div>")]
        public void RestUri_RendersAsDataUri(string uri, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestSelectionTheme("themePicker")
            {
                RestUri = _ => uri is not null ? new UriEndpoint(uri) : null
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }
    }
}
