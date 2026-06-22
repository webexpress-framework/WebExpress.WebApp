using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebApp.WebData;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the watcher control. The control only emits the
    /// host element; the actual rendering happens in the JS controller
    /// <c>webexpress.webapp.WatcherCtrl</c>.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlWatcher
    {
        /// <summary>
        /// Tests the id property of the watcher control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-watcher""></div>")]
        [InlineData("id", @"<div id=""id"" class=""wx-webapp-watcher""></div>")]
        [InlineData("87BD7E47-9D08-4DAB-BFFE-DA2B2DD12C3B", @"<div id=""87BD7E47-9D08-4DAB-BFFE-DA2B2DD12C3B"" class=""wx-webapp-watcher""></div>")]
        public void Id(string id, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataWatcher(id);

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the RestUri property of the watcher control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-watcher""></div>")]
        [InlineData("https://example.com/api/watchers/INC-00123", @"<div class=""wx-webapp-watcher""><wx-service hidden name=""data"" kind=""rest"" base-uri=""https://example.com/api/watchers/INC-00123"" method=""GET"" update-method=""PUT""></wx-service></div>")]
        public void RestUri(string uriString, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataWatcher()
            {
                ServiceFactory = uriString is not null ? _ => DataServiceDescriptor.Data(uriString) : null
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the UsersUri property of the watcher control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-watcher""></div>")]
        [InlineData("https://example.com/api/users", @"<div class=""wx-webapp-watcher""><wx-service hidden name=""users"" kind=""rest"" base-uri=""https://example.com/api/users"" method=""GET""></wx-service></div>")]
        public void UsersUri(string uriString, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataWatcher()
            {
                ServiceFactory = uriString is not null ? _ => DataServiceDescriptor.Rest("users").WithBaseUri(uriString).WithMethod("GET") : null
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
        [InlineData(null, @"<div class=""wx-webapp-watcher""></div>")]
        [InlineData(8, @"<div class=""wx-webapp-watcher"" data-max-visible=""8""></div>")]
        public void MaxVisible(int? maxVisible, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataWatcher()
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
        [InlineData(false, @"<div class=""wx-webapp-watcher""></div>")]
        [InlineData(true, @"<div class=""wx-webapp-watcher"" data-readonly=""true""></div>")]
        public void Readonly(bool readOnly, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataWatcher()
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
            var control = new ControlDataWatcher("o1")
            {
                ServiceFactories =
                {
                    _ => DataServiceDescriptor.Data("https://example.com/api/watchers/INC-1"),
                    _ => DataServiceDescriptor.Rest("users").WithBaseUri("https://example.com/api/users").WithMethod("GET")
                },
                MaxVisible = _ => 5,
                Readonly = _ => true
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(@"<div id=""o1"" class=""wx-webapp-watcher"" data-max-visible=""5"" data-readonly=""true""><wx-service hidden name=""data"" kind=""rest"" base-uri=""https://example.com/api/watchers/INC-1"" method=""GET"" update-method=""PUT""></wx-service><wx-service hidden name=""users"" kind=""rest"" base-uri=""https://example.com/api/users"" method=""GET""></wx-service></div>", html);
        }

        /// <summary>
        /// Disabled controls must render to <c>null</c> so the page does
        /// not contain an inert watcher host.
        /// </summary>
        [Fact]
        public void Enable_False_RendersNothing()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataWatcher()
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
