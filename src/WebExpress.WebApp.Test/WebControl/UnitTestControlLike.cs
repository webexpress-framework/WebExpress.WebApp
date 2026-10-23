using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebIcon;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the like figure control.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlLike
    {
        /// <summary>
        /// Tests the id property. Without an address the figure is a span, because there is
        /// nothing to join.
        /// </summary>
        /// <param name="id">The control id under test.</param>
        /// <param name="expected">The expected markup.</param>
        [Theory]
        [InlineData(null, @"<span id=""*"" class=""wx-webapp-like""><span class=""wx-webapp-like-value"">0</span><i class=""wx-icon-light wx-icon-light-thumbs-up wx-webapp-like-icon"" aria-hidden=""true""></i></span>")]
        [InlineData("id", @"<span id=""id"" class=""wx-webapp-like""><span class=""wx-webapp-like-value"">0</span><i class=""wx-icon-light wx-icon-light-thumbs-up wx-webapp-like-icon"" aria-hidden=""true""></i></span>")]
        public void Id(string id, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlLike(id);

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the Value property - the count is rendered by the server, so it is on the page
        /// before any script runs.
        /// </summary>
        /// <param name="value">The count under test.</param>
        /// <param name="expected">The expected number in the markup.</param>
        [Theory]
        [InlineData(0, "0")]
        [InlineData(7, "7")]
        public void Value(int value, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlLike("id")
            {
                Value = _ => value
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders
            (
                @"<span id=""id"" class=""wx-webapp-like""><span class=""wx-webapp-like-value"">" + expected + @"</span><i class=""wx-icon-light wx-icon-light-thumbs-up wx-webapp-like-icon"" aria-hidden=""true""></i></span>",
                html
            );
        }

        /// <summary>
        /// Tests the Uri property - an address turns the figure into a button carrying the
        /// address and the body, which is what the client controller posts.
        /// </summary>
        [Fact]
        public void Uri_MakesItJoinable()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlLike("id")
            {
                Value = _ => 7,
                Uri = _ => new UriEndpoint("/api/1/objects/like"),
                Payload = _ => @"{""object"":""SD-1""}"
            };

            // act
            var html = control.Render(context, visualTree)?.ToString();

            // validation
            Assert.Contains("<button", html);
            Assert.Contains(@"class=""wx-webapp-like wx-webapp-like-action wx-webapp-like-mount""", html);
            Assert.Contains(@"data-uri=""/api/1/objects/like""", html);
            Assert.Contains(@"aria-pressed=""false""", html);
            Assert.DoesNotContain("wx-webapp-like-active", html);

            // the payload is json, and an attribute value carrying a raw double quote closes the
            // attribute early - the rest of it would land in the markup as stray attributes
            Assert.Contains(@"data-payload=""{&quot;object&quot;:&quot;SD-1&quot;}""", html);
        }

        /// <summary>
        /// Tests the Active property - a reader who is among the count sees the figure pressed.
        /// </summary>
        [Fact]
        public void Active_MarksTheFigurePressed()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlLike("id")
            {
                Uri = _ => new UriEndpoint("/api/1/objects/like"),
                Active = _ => true
            };

            // act
            var html = control.Render(context, visualTree)?.ToString();

            // validation
            Assert.Contains("wx-webapp-like-active", html);
            Assert.Contains(@"aria-pressed=""true""", html);
        }

        /// <summary>
        /// Tests that the pressed state is ignored without an address: a figure nobody can join
        /// must not look joined.
        /// </summary>
        [Fact]
        public void Active_WithoutUri_IsNotShown()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlLike("id")
            {
                Active = _ => true
            };

            // act
            var html = control.Render(context, visualTree)?.ToString();

            // validation
            Assert.DoesNotContain("wx-webapp-like-active", html);
            Assert.DoesNotContain("aria-pressed", html);
            Assert.DoesNotContain("<button", html);
        }

        /// <summary>
        /// Tests the Icon property - a surface that likes something other than a post can say so
        /// with a different glyph.
        /// </summary>
        [Fact]
        public void Icon_ReplacesTheGlyph()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlLike("id")
            {
                Icon = _ => new IconHeart()
            };

            // act
            var html = control.Render(context, visualTree)?.ToString();

            // validation
            Assert.Contains("wx-icon-light-heart", html);
            Assert.DoesNotContain("thumbs-up", html);
        }

        /// <summary>
        /// Tests the Enable property - a disabled control renders nothing at all.
        /// </summary>
        [Fact]
        public void Enable_False_RendersNothing()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlLike("id")
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
