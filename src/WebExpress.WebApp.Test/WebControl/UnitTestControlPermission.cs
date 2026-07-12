using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebApp.WebData;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the permission control. The control only emits the
    /// host element; the actual rendering happens in the JS controller
    /// <c>webexpress.webapp.PermissionCtrl</c>.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlPermission
    {
        /// <summary>
        /// Tests the id property of the permission control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-permission""></div>")]
        [InlineData("id", @"<div id=""id"" class=""wx-webapp-permission""></div>")]
        [InlineData("87BD7E47-9D08-4DAB-BFFE-DA2B2DD12C3B", @"<div id=""87BD7E47-9D08-4DAB-BFFE-DA2B2DD12C3B"" class=""wx-webapp-permission""></div>")]
        public void Id(string id, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataPermission(id);

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the data service island of the permission control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-permission""></div>")]
        [InlineData("https://example.com/api/permissions/incident", @"<div class=""wx-webapp-permission""><wx-service hidden name=""data"" kind=""rest"" base-uri=""https://example.com/api/permissions/incident"" method=""GET""></wx-service></div>")]
        public void Service(string uriString, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataPermission()
            {
                ServiceFactory = uriString is not null ? _ => DataServiceDescriptor.QueryData(uriString) : null
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the groups service island of the permission control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-permission""></div>")]
        [InlineData("https://example.com/api/groups", @"<div class=""wx-webapp-permission""><wx-service hidden name=""groups"" kind=""rest"" base-uri=""https://example.com/api/groups"" method=""GET""></wx-service></div>")]
        public void GroupsUri(string uriString, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataPermission()
            {
                ServiceFactory = uriString is not null ? _ => DataServiceDescriptor.Rest("groups").WithBaseUri(uriString).WithMethod("GET") : null
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests that the PageSize property renders into the
        /// <c>data-page-size</c> attribute.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-permission""></div>")]
        [InlineData(25, @"<div class=""wx-webapp-permission"" data-page-size=""25""></div>")]
        public void PageSize(int? pageSize, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataPermission()
            {
                PageSize = _ => pageSize
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
        [InlineData(false, @"<div class=""wx-webapp-permission""></div>")]
        [InlineData(true, @"<div class=""wx-webapp-permission"" data-readonly=""true""></div>")]
        public void Readonly(bool readOnly, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataPermission()
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
            var control = new ControlDataPermission("o1")
            {
                ServiceFactories =
                {
                    _ => DataServiceDescriptor.QueryData("https://example.com/api/permissions/incident"),
                    _ => DataServiceDescriptor.Rest("groups").WithBaseUri("https://example.com/api/groups").WithMethod("GET"),
                    _ => DataServiceDescriptor.Rest("policies").WithBaseUri("https://example.com/api/policies").WithMethod("GET")
                },
                PageSize = _ => 5,
                Readonly = _ => true
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(@"<div id=""o1"" class=""wx-webapp-permission"" data-page-size=""5"" data-readonly=""true""><wx-service hidden name=""data"" kind=""rest"" base-uri=""https://example.com/api/permissions/incident"" method=""GET""></wx-service><wx-service hidden name=""groups"" kind=""rest"" base-uri=""https://example.com/api/groups"" method=""GET""></wx-service><wx-service hidden name=""policies"" kind=""rest"" base-uri=""https://example.com/api/policies"" method=""GET""></wx-service></div>", html);
        }

        /// <summary>
        /// Disabled controls must render to <c>null</c> so the page does
        /// not contain an inert permission host.
        /// </summary>
        [Fact]
        public void Enable_False_RendersNothing()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataPermission()
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
