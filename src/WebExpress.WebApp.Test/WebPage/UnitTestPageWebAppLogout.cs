using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebPage;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebPage
{
    /// <summary>
    /// Tests the logout page.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestPageWebAppLogout
    {
        /// <summary>
        /// Tests that the logout page can be processed without throwing an exception.
        /// </summary>
        [Fact]
        public void Process_DoesNotThrow()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeWebAppLogin(componentHub, context.PageContext);
            var page = new PageWebAppLogout();

            // act
            var exception = Record.Exception(() => page.Process(context, visualTree));

            // validation
            Assert.Null(exception);
        }

        /// <summary>
        /// Tests that the logout page populates the visual tree content area.
        /// </summary>
        [Fact]
        public void Process_PopulatesContent()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeWebAppLogin(componentHub, context.PageContext);
            var page = new PageWebAppLogout();

            // act
            page.Process(context, visualTree);

            // validation
            Assert.NotEmpty(visualTree.Content.MainPanel.Primary);
        }

        /// <summary>
        /// Tests that the logout page sets the visual tree title.
        /// </summary>
        [Fact]
        public void Process_SetsTitle()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeWebAppLogin(componentHub, context.PageContext);
            var page = new PageWebAppLogout();

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
            var visualTree = new VisualTreeWebAppLogin(componentHub, context.PageContext);
            var page = new PageWebAppLogout();

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
            var page = new PageWebAppLogout();

            // act & validation
            Assert.Throws<ArgumentNullException>(() => page.Process(context, null));
        }
    }
}
