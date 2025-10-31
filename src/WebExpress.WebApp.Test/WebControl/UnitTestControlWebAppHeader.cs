using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the web app header control.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlWebAppHeader
    {
        /// <summary>
        /// Tests the id property of the web app header control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<header class=""navbar p-0 fixed-top"" style=""display: block; position: sticky; top: 0; z-index: 99;"">*</header>")]
        [InlineData("id", @"<header id=""id"" class=""navbar p-0 fixed-top"" style=""display: block; position: sticky; top: 0; z-index: 99;"">*</header>")]
        public void Id(string id, string expected)
        {
            // preconditions
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlWebAppHeader(id)
            {
            };

            // test execution
            var html = control.Render(context, visualTree);

            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the text color property of the web app header control.
        /// </summary>
        [Theory]
        [InlineData(TypeColorNavbar.Primary, @"<header class=""navbar p-0 fixed-top navbar-primary"" style=""display: block; position: sticky; top: 0; z-index: 99;"">*</header>")]
        [InlineData(TypeColorNavbar.Secondary, @"<header class=""navbar p-0 fixed-top navbar-secondary"" style=""display: block; position: sticky; top: 0; z-index: 99;"">*</header>")]
        [InlineData(TypeColorNavbar.Info, @"<header class=""navbar p-0 fixed-top navbar-info"" style=""display: block; position: sticky; top: 0; z-index: 99;"">*</header>")]
        [InlineData(TypeColorNavbar.Success, @"<header class=""navbar p-0 fixed-top navbar-success"" style=""display: block; position: sticky; top: 0; z-index: 99;"">*</header>")]
        [InlineData(TypeColorNavbar.Warning, @"<header class=""navbar p-0 fixed-top navbar-warning"" style=""display: block; position: sticky; top: 0; z-index: 99;"">*</header>")]
        [InlineData(TypeColorNavbar.Danger, @"<header class=""navbar p-0 fixed-top navbar-danger"" style=""display: block; position: sticky; top: 0; z-index: 99;"">*</header>")]
        [InlineData(TypeColorNavbar.Light, @"<header class=""navbar p-0 fixed-top navbar-light"" style=""display: block; position: sticky; top: 0; z-index: 99;"">*</header>")]
        [InlineData(TypeColorNavbar.Dark, @"<header class=""navbar p-0 fixed-top navbar-dark"" style=""display: block; position: sticky; top: 0; z-index: 99;"">*</header>")]
        [InlineData(TypeColorNavbar.White, @"<header class=""navbar p-0 fixed-top navbar-white"" style=""display: block; position: sticky; top: 0; z-index: 99;"">*</header>")]
        [InlineData(TypeColorNavbar.Transparent, @"<header class=""navbar p-0 fixed-top navbar-transparent"" style=""display: block; position: sticky; top: 0; z-index: 99;"">*</header>")]
        public void TextColor(TypeColorNavbar textColor, string expected)
        {
            // preconditions
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlWebAppHeader()
            {
                TextColor = new PropertyColorNavbar(textColor)
            };

            // test execution
            var html = control.Render(context, visualTree);

            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the fixed property of the web app header control.
        /// </summary>
        [Theory]
        [InlineData(TypeFixed.None, @"<header class=""navbar p-0"" style=""display: block; position: sticky; top: 0; z-index: 99;"">*</header>")]
        [InlineData(TypeFixed.Top, @"<header class=""navbar p-0 fixed-top"" style=""display: block; position: sticky; top: 0; z-index: 99;"">*</header>")]
        [InlineData(TypeFixed.Bottom, @"<header class=""navbar p-0 fixed-bottom"" style=""display: block; position: sticky; top: 0; z-index: 99;"">*</header>")]
        public void Fixed(TypeFixed fixedProperty, string expected)
        {
            // preconditions
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlWebAppHeader()
            {
                Fixed = fixedProperty
            };

            // test execution
            var html = control.Render(context, visualTree);

            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the sticky property of the web app header control.
        /// </summary>
        [Theory]
        [InlineData(TypeSticky.None, @"<header class=""navbar p-0 fixed-top"" style=""display: block; position: sticky; top: 0; z-index: 99;"">*</header>")]
        [InlineData(TypeSticky.Top, @"<header class=""navbar p-0 fixed-top sticky-top"" style=""display: block; position: sticky; top: 0; z-index: 99;"">*</div></header>")]
        public void Sticky(TypeSticky sticky, string expected)
        {
            // preconditions
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlWebAppHeader()
            {
                Sticky = sticky
            };

            // test execution
            var html = control.Render(context, visualTree);

            AssertExtensions.EqualWithPlaceholders(expected, html);
        }
    }
}
