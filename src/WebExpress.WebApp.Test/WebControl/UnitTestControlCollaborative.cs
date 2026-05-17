using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the collaborative control.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlCollaborative
    {
        /// <summary>
        /// Tests the id property of the collaborative control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-collaborative""></div>")]
        [InlineData("id", @"<div id=""id"" class=""wx-webapp-collaborative""></div>")]
        public void Id(string id, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlCollaborative(id)
            {
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests collaborative feature flags.
        /// </summary>
        [Theory]
        [InlineData(true, true, true, @"<div class=""wx-webapp-collaborative""></div>")]
        [InlineData(false, true, true, @"<div class=""wx-webapp-collaborative"" data-collaborative-presence=""false""></div>")]
        [InlineData(true, false, true, @"<div class=""wx-webapp-collaborative"" data-collaborative-cursor=""false""></div>")]
        [InlineData(true, true, false, @"<div class=""wx-webapp-collaborative"" data-collaborative-input=""false""></div>")]
        public void FeatureFlags(bool presence, bool cursor, bool input, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlCollaborative()
            {
                Presence = _ => presence,
                Cursor = _ => cursor,
                Input = _ => input
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests collaborative identity and color attributes.
        /// </summary>
        [Fact]
        public void Attributes()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlCollaborative("collab")
            {
                ColorMode = _ => "auto",
                UserId = _ => "u-alice",
                UserName = _ => "Alice",
                UserColor = _ => "#3B82F6"
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(@"<div id=""collab"" class=""wx-webapp-collaborative"" data-collaborative-color-mode=""auto"" data-collaborative-user-id=""u-alice"" data-collaborative-user-name=""Alice"" data-collaborative-color=""#3B82F6""></div>", html);
        }

        /// <summary>
        /// Tests that nested controls are rendered inside the collaborative host.
        /// </summary>
        [Fact]
        public void ChildControls()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlCollaborative("collab", new ControlText() { Text = _ => "Hello" });

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(@"<div id=""collab"" class=""wx-webapp-collaborative""><div>Hello</div></div>", html);
        }
    }
}
