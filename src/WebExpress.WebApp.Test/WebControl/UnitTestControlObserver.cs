using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the observer (watcher) control. The control only emits the
    /// host element; the actual rendering happens in the JS controller
    /// <c>webexpress.webapp.ObserverCtrl</c>.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlObserver
    {
        /// <summary>
        /// Tests the id property of the observer control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-observer""></div>")]
        [InlineData("id", @"<div id=""id"" class=""wx-webapp-observer""></div>")]
        [InlineData("87BD7E47-9D08-4DAB-BFFE-DA2B2DD12C3B", @"<div id=""87BD7E47-9D08-4DAB-BFFE-DA2B2DD12C3B"" class=""wx-webapp-observer""></div>")]
        public void Id(string id, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestObserver(id);

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the RestUri property of the observer control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-observer""></div>")]
        [InlineData("https://example.com/api/observers/INC-00123", @"<div class=""wx-webapp-observer"" data-uri=""https://example.com/api/observers/INC-00123""></div>")]
        public void RestUri(string uriString, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestObserver()
            {
                RestUri = _ => uriString is not null ? new UriEndpoint(uriString) : null
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the UsersUri property of the observer control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-observer""></div>")]
        [InlineData("https://example.com/api/users", @"<div class=""wx-webapp-observer"" data-users-uri=""https://example.com/api/users""></div>")]
        public void UsersUri(string uriString, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestObserver()
            {
                UsersUri = _ => uriString is not null ? new UriEndpoint(uriString) : null
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests that the MaxVisible property renders into the
        /// <c>data-max-visible</c> attribute.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-observer""></div>")]
        [InlineData(8, @"<div class=""wx-webapp-observer"" data-max-visible=""8""></div>")]
        public void MaxVisible(int? maxVisible, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestObserver()
            {
                MaxVisible = _ => maxVisible
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
        [InlineData(false, @"<div class=""wx-webapp-observer""></div>")]
        [InlineData(true, @"<div class=""wx-webapp-observer"" data-readonly=""true""></div>")]
        public void Readonly(bool readOnly, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestObserver()
            {
                Readonly = _ => readOnly
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
            var control = new ControlRestObserver("o1")
            {
                RestUri = _ => new UriEndpoint("https://example.com/api/observers/INC-1"),
                UsersUri = _ => new UriEndpoint("https://example.com/api/users"),
                MaxVisible = _ => 5,
                Readonly = _ => true
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(@"<div id=""o1"" class=""wx-webapp-observer"" data-uri=""https://example.com/api/observers/INC-1"" data-users-uri=""https://example.com/api/users"" data-max-visible=""5"" data-readonly=""true""></div>", html);
        }

        /// <summary>
        /// Disabled controls must render to <c>null</c> so the page does
        /// not contain an inert observer host.
        /// </summary>
        [Fact]
        public void Enable_False_RendersNothing()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestObserver()
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
