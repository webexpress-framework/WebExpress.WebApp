using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebPage;
using WebExpress.WebCore.WebPage;
using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.Test.WebPage
{
    /// <summary>
    /// Verifies landing composition and the shared scoped cookie banner slot.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestVisualTreeWebAppLanding
    {
        /// <summary>
        /// Protects the continuous layout and existing content API against application splitters.
        /// </summary>
        [Fact]
        public void Render_Landing_UsesContinuousContentAndHeroFragments()
        {
            // arrange
            var hub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = hub.ApplicationManager.GetApplications(typeof(TestApplication)).First();
            var context = UnitTestControlFixture.CreateRenderContextMock(application, [typeof(TestPageA)]);
            var tree = new VisualTreeWebAppLanding(hub, context.PageContext);
            tree.LandingHeader.Add(new ControlText { Text = _ => "landing-page-header" });
            tree.LandingFooter.Add(new ControlText { Text = _ => "landing-page-footer" });
            tree.Footer.AddPrimary(new ControlText { Text = _ => "shared-footer-content" });
            tree.Hero.Add(new ControlText { Text = _ => "landing-page-hero" });
            tree.Content.MainPanel.AddPrimary(new ControlText { Text = _ => "landing-page-content" });

            // act
            var html = tree.Render(new VisualTreeContext(context)).ToString();
            var repeated = tree.Render(new VisualTreeContext(context)).ToString();

            // validation
            Assert.Contains("wx-landing", html);
            Assert.Contains("landing-page-header", html);
            Assert.Single(repeated.Split("landing-header-fragment").Skip(1));
            Assert.Single(repeated.Split("landing-footer-fragment").Skip(1));
            Assert.Contains("landing-page-footer", html);
            Assert.Contains("shared-footer-content", html);
            Assert.DoesNotContain("id=\"wx-header\"", html);
            Assert.DoesNotContain("id=\"wx-content-main-headline\"", html);
            Assert.Contains("id=\"wx-landing-main\"", html);
            Assert.True(html.IndexOf("id=\"wx-landing-main\"") < html.IndexOf("landing-page-hero"));
            Assert.Contains("landing-page-hero", html);
            Assert.Contains("landing-hero-fragment", html);
            Assert.Contains("landing-page-content", html);
            Assert.Contains("webexpress-webapp-test-testfragmentpagea", html);
            Assert.DoesNotContain("id=\"wx-split\"", html);
            Assert.DoesNotContain("id=\"wx-splitter-content\"", html);
            Assert.DoesNotContain("id=\"wx-breadcrumb\"", html);
            Assert.True(html.IndexOf("landing-hero-fragment") < html.IndexOf("landing-page-content"));
            Assert.Single(repeated.Split("landing-hero-fragment").Skip(1));
        }

        /// <summary>
        /// Ensures both page types render a scoped cookie fragment exactly once.
        /// </summary>
        /// <param name="landing">Whether to use the landing layout.</param>
        /// <param name="matchingScope">Whether the page is inside the banner's registered scope.</param>
        [Theory]
        [InlineData(false, true)]
        [InlineData(true, true)]
        [InlineData(false, false)]
        [InlineData(true, false)]
        public void Render_CookieBanner_RespectsScope(bool landing, bool matchingScope)
        {
            // arrange
            var hub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = hub.ApplicationManager.GetApplications(typeof(TestApplication)).First();
            var context = UnitTestControlFixture.CreateRenderContextMock(application,
                matchingScope ? [typeof(TestPageA)] : [typeof(TestPageB)]);
            VisualTreeWebApp tree = landing
                ? new VisualTreeWebAppLanding(hub, context.PageContext)
                : new VisualTreeWebApp(hub, context.PageContext);

            // act
            var html = tree.Render(new VisualTreeContext(context)).ToString();

            // validation
            Assert.Equal(matchingScope ? 1 : 0, html.Split("landing-cookie-test").Length - 1);
            Assert.Equal(landing && matchingScope ? 1 : 0, html.Split("landing-header-fragment").Length - 1);
            Assert.Equal(landing && matchingScope ? 1 : 0, html.Split("landing-footer-fragment").Length - 1);
            if (!landing)
            {
                Assert.Contains("id=\"wx-content\"", html);
                Assert.DoesNotContain("landing-hero-fragment", html);
            }
        }
    }
}
