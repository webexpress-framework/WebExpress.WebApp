using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebPage;

namespace WebExpress.WebApp.Test.WebPage
{
    /// <summary>
    /// Tests the access-denied page.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestPageWebAppForbidden
    {
        /// <summary>
        /// Tests that the forbidden page can be processed without throwing an exception.
        /// </summary>
        [Fact]
        public void Process_DoesNotThrow()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeWebApp(componentHub, context.PageContext);
            var page = new PageWebAppForbidden();

            // act
            var exception = Record.Exception(() => page.Process(context, visualTree));

            // validation
            Assert.Null(exception);
        }

        /// <summary>
        /// Tests that the forbidden page populates the visual tree content area.
        /// </summary>
        [Fact]
        public void Process_PopulatesContent()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeWebApp(componentHub, context.PageContext);
            var page = new PageWebAppForbidden();

            // act
            page.Process(context, visualTree);

            // validation
            Assert.NotEmpty(visualTree.Content.MainPanel.Primary);
        }

        /// <summary>
        /// Tests that the forbidden page sets the visual tree title.
        /// </summary>
        [Fact]
        public void Process_SetsTitle()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeWebApp(componentHub, context.PageContext);
            var page = new PageWebAppForbidden();

            // act
            page.Process(context, visualTree);

            // validation
            Assert.NotNull(visualTree.Title);
        }

        /// <summary>
        /// Tests that Process throws ArgumentNullException when renderContext is null.
        /// </summary>
        [Fact]
        public void Process_NullRenderContext_ThrowsArgumentNullException()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeWebApp(componentHub, context.PageContext);
            var page = new PageWebAppForbidden();

            // act & validation
            Assert.Throws<ArgumentNullException>(() => page.Process(null, visualTree));
        }

        /// <summary>
        /// Tests that Process throws ArgumentNullException when visualTree is null.
        /// </summary>
        [Fact]
        public void Process_NullVisualTree_ThrowsArgumentNullException()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var page = new PageWebAppForbidden();

            // act & validation
            Assert.Throws<ArgumentNullException>(() => page.Process(context, null));
        }
    }
}
