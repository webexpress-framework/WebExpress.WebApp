using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the REST-backed tag control. The control only emits the host
    /// element; the actual rendering happens in the JS controller
    /// <c>webexpress.webapp.TagCtrl</c>.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlDataTag
    {
        /// <summary>
        /// Tests the id property of the tag control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-tag""></div>")]
        [InlineData("id", @"<div id=""id"" class=""wx-webapp-tag""></div>")]
        public void Id(string id, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataTag(id)
            {
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the RestUri property of the tag control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-tag""></div>")]
        [InlineData("https://example.com/api/tags/INC-1", @"<div class=""wx-webapp-tag"" data-uri=""https://example.com/api/tags/INC-1""></div>")]
        public void RestUri(string uriString, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataTag()
            {
                RestUri = _ => uriString is not null ? new UriEndpoint(uriString) : null
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests that the Readonly flag suppresses or emits the
        /// <c>data-readonly</c> attribute.
        /// </summary>
        [Theory]
        [InlineData(false, @"<div class=""wx-webapp-tag""></div>")]
        [InlineData(true, @"<div class=""wx-webapp-tag"" data-readonly=""true""></div>")]
        public void Readonly(bool readOnly, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataTag()
            {
                Readonly = _ => readOnly
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the placeholder property of the tag control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-tag""></div>")]
        [InlineData("abc", @"<div class=""wx-webapp-tag"" placeholder=""abc""></div>")]
        [InlineData("webexpress.webui:plugin.name", @"<div class=""wx-webapp-tag"" placeholder=""WebExpress.WebUI""></div>")]
        public void Placeholder(string placeholder, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataTag()
            {
                Placeholder = _ => placeholder
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the system color property of the tag control.
        /// </summary>
        [Theory]
        [InlineData(TypeColorTag.Default, @"<div class=""wx-webapp-tag""></div>")]
        [InlineData(TypeColorTag.Primary, @"<div class=""wx-webapp-tag"" data-color-css=""wx-tag-primary""></div>")]
        [InlineData(TypeColorTag.Secondary, @"<div class=""wx-webapp-tag"" data-color-css=""wx-tag-secondary""></div>")]
        [InlineData(TypeColorTag.Success, @"<div class=""wx-webapp-tag"" data-color-css=""wx-tag-success""></div>")]
        [InlineData(TypeColorTag.Danger, @"<div class=""wx-webapp-tag"" data-color-css=""wx-tag-danger""></div>")]
        public void SystemColor(TypeColorTag color, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataTag()
            {
                Color = _ => new PropertyColorTag(color)
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the user color property of the tag control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-tag""></div>")]
        [InlineData("", @"<div class=""wx-webapp-tag""></div>")]
        [InlineData(" ", @"<div class=""wx-webapp-tag""></div>")]
        [InlineData("gold", @"<div class=""wx-webapp-tag"" data-color-style=""background: gold;""></div>")]
        public void UserColor(string color, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataTag()
            {
                Color = _ => new PropertyColorTag(color)
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests that the seeded values render into the <c>data-value</c>
        /// attribute joined by a semicolon.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-tag""></div>")]
        [InlineData(new[] { "abc" }, @"<div class=""wx-webapp-tag"" data-value=""abc""></div>")]
        [InlineData(new[] { "abc", "def" }, @"<div class=""wx-webapp-tag"" data-value=""abc;def""></div>")]
        public void Value(string[] value, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataTag()
            {
                Value = _ => value
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests every data attribute rendering together.
        /// </summary>
        [Fact]
        public void AllAttributes()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataTag("t1")
            {
                RestUri = _ => new UriEndpoint("https://example.com/api/tags/INC-1"),
                Placeholder = _ => "add tag",
                Value = _ => ["alpha", "beta"],
                Readonly = _ => true,
                Color = _ => new PropertyColorTag(TypeColorTag.Primary)
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(@"<div id=""t1"" class=""wx-webapp-tag"" data-uri=""https://example.com/api/tags/INC-1"" placeholder=""add tag"" data-value=""alpha;beta"" data-readonly=""true"" data-color-css=""wx-tag-primary""></div>", html);
        }

        /// <summary>
        /// Disabled controls must render to <c>null</c> so the page does not
        /// contain an inert tag host.
        /// </summary>
        [Fact]
        public void Enable_False_RendersNothing()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataTag()
            {
                Enable = _ => false
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            Assert.Null(html);
        }
    }
}
