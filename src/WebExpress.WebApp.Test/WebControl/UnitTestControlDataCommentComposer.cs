using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the comment composer control.
    /// </summary>
    public class UnitTestControlDataCommentComposer
    {
        /// <summary>
        /// Tests that only a composer resolved as expanded tells the client to start expanded.
        /// </summary>
        /// <param name="expanded">The resolved state, or null for no resolver.</param>
        /// <param name="emitted">Whether the client is told to start expanded.</param>
        [Theory]
        [InlineData(null, false)]
        [InlineData(false, false)]
        [InlineData(true, true)]
        public void Expanded(bool? expanded, bool emitted)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataCommentComposer("composer")
            {
                Expanded = expanded.HasValue ? _ => expanded.Value : null
            };

            // act
            var html = control.Render(context, visualTree).ToString();

            // validation
            Assert.Equal(emitted, html.Contains("data-expanded=\"true\""));
        }
    }
}
