using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebPage;
using WebExpress.WebCore.WebPage;

namespace WebExpress.WebApp.Test.WebPage
{
    /// <summary>
    /// Tests the abstract login page base class.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestPageWebAppLogin
    {
        /// <summary>
        /// A minimal concrete implementation for testing the abstract base class.
        /// </summary>
        private sealed class TestLoginPage : PageWebAppLogin
        {
            public bool ProcessCalled { get; private set; }

            public override void Process(IRenderContext renderContext, VisualTreeWebAppLogin visualTree)
            {
                ProcessCalled = true;
                base.Process(renderContext, visualTree);
            }
        }

        /// <summary>
        /// Tests that a concrete login page subclass can be processed without throwing an exception.
        /// </summary>
        [Fact]
        public void Process_DoesNotThrow()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeWebAppLogin(componentHub, context.PageContext);
            var page = new TestLoginPage();

            // act
            var exception = Record.Exception(() => page.Process(context, visualTree));

            // validation
            Assert.Null(exception);
        }

        /// <summary>
        /// Tests that the concrete login page subclass Process method is invoked.
        /// </summary>
        [Fact]
        public void Process_IsInvoked()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeWebAppLogin(componentHub, context.PageContext);
            var page = new TestLoginPage();

            // act
            page.Process(context, visualTree);

            // validation
            Assert.True(page.ProcessCalled);
        }

        /// <summary>
        /// Tests that the login visual tree can have its title assigned.
        /// </summary>
        [Fact]
        public void VisualTree_TitleCanBeSet()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeWebAppLogin(componentHub, context.PageContext);

            // act
            visualTree.Title = "Test Login";

            // validation
            Assert.Equal("Test Login", visualTree.Title);
        }

        /// <summary>
        /// Tests that Process can be called with null renderContext without throwing
        /// (base implementation is empty and performs no null checks).
        /// </summary>
        [Fact]
        public void BaseProcess_NullRenderContext_DoesNotThrow()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeWebAppLogin(componentHub, context.PageContext);
            var page = new TestLoginPage();

            // act
            var exception = Record.Exception(() => page.Process(null, visualTree));

            // validation
            Assert.Null(exception);
        }

        /// <summary>
        /// Tests that Process can be called with null visualTree without throwing
        /// (base implementation is empty and performs no null checks).
        /// </summary>
        [Fact]
        public void BaseProcess_NullVisualTree_DoesNotThrow()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var page = new TestLoginPage();

            // act
            var exception = Record.Exception(() => page.Process(context, null));

            // validation
            Assert.Null(exception);
        }
    }
}
