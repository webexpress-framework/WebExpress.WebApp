using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebApp.WebData;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the permission control. The control only emits the host element
    /// and the pagination control it binds through the paging bind; the table
    /// itself is rendered by the JS controller
    /// <c>webexpress.webapp.PermissionCtrl</c>.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlPermission
    {
        /// <summary>
        /// Tests the id property of the permission control. Without an explicit
        /// id the control generates one, because the pager it binds is
        /// addressed through the host id.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div id=""*"" class=""wx-webapp-permission"" data-page-size=""10"" data-wx-source-paging=""#*_pager"" data-wx-bind=""paging""></div><div id=""*_pager"" class=""wx-webui-pagination""></div>")]
        [InlineData("id", @"<div id=""id"" class=""wx-webapp-permission"" data-page-size=""10"" data-wx-source-paging=""#id_pager"" data-wx-bind=""paging""></div><div id=""id_pager"" class=""wx-webui-pagination""></div>")]
        [InlineData("87BD7E47-9D08-4DAB-BFFE-DA2B2DD12C3B", @"<div id=""87BD7E47-9D08-4DAB-BFFE-DA2B2DD12C3B"" class=""wx-webapp-permission"" data-page-size=""10"" data-wx-source-paging=""#87BD7E47-9D08-4DAB-BFFE-DA2B2DD12C3B_pager"" data-wx-bind=""paging""></div><div id=""87BD7E47-9D08-4DAB-BFFE-DA2B2DD12C3B_pager"" class=""wx-webui-pagination""></div>")]
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
        [InlineData(null, @"<div id=""o1"" class=""wx-webapp-permission"" data-page-size=""10"" data-wx-source-paging=""#o1_pager"" data-wx-bind=""paging""></div><div id=""o1_pager"" class=""wx-webui-pagination""></div>")]
        [InlineData("https://example.com/api/permissions/incident", @"<div id=""o1"" class=""wx-webapp-permission"" data-page-size=""10"" data-wx-source-paging=""#o1_pager"" data-wx-bind=""paging""><wx-service hidden name=""data"" kind=""rest"" base-uri=""https://example.com/api/permissions/incident"" method=""GET""></wx-service></div><div id=""o1_pager"" class=""wx-webui-pagination""></div>")]
        public void Service(string uriString, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataPermission("o1")
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
        [InlineData(null, @"<div id=""o1"" class=""wx-webapp-permission"" data-page-size=""10"" data-wx-source-paging=""#o1_pager"" data-wx-bind=""paging""></div><div id=""o1_pager"" class=""wx-webui-pagination""></div>")]
        [InlineData("https://example.com/api/groups", @"<div id=""o1"" class=""wx-webapp-permission"" data-page-size=""10"" data-wx-source-paging=""#o1_pager"" data-wx-bind=""paging""><wx-service hidden name=""groups"" kind=""rest"" base-uri=""https://example.com/api/groups"" method=""GET""></wx-service></div><div id=""o1_pager"" class=""wx-webui-pagination""></div>")]
        public void GroupsUri(string uriString, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataPermission("o1")
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
        /// <c>data-page-size</c> attribute and defaults to ten.
        /// </summary>
        [Theory]
        [InlineData(null, "10")]
        [InlineData(25, "25")]
        public void PageSize(int? pageSize, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataPermission("o1")
            {
                PageSize = _ => pageSize
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(
                $@"<div id=""o1"" class=""wx-webapp-permission"" data-page-size=""{expected}"" data-wx-source-paging=""#o1_pager"" data-wx-bind=""paging""></div><div id=""o1_pager"" class=""wx-webui-pagination""></div>",
                html);
        }

        /// <summary>
        /// Tests that the Readonly flag suppresses or emits the
        /// <c>data-readonly</c> attribute.
        /// </summary>
        [Theory]
        [InlineData(false, @"<div id=""o1"" class=""wx-webapp-permission"" data-page-size=""10"" data-wx-source-paging=""#o1_pager"" data-wx-bind=""paging""></div><div id=""o1_pager"" class=""wx-webui-pagination""></div>")]
        [InlineData(true, @"<div id=""o1"" class=""wx-webapp-permission"" data-page-size=""10"" data-readonly=""true"" data-wx-source-paging=""#o1_pager"" data-wx-bind=""paging""></div><div id=""o1_pager"" class=""wx-webui-pagination""></div>")]
        public void Readonly(bool readOnly, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataPermission("o1")
            {
                Readonly = _ => readOnly
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests that an authored binding survives next to the paging bind the
        /// control always adds, so a page can attach a search control.
        /// </summary>
        [Fact]
        public void Bind_KeepsAuthoredBindNextToPaging()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataPermission("o1")
            {
                Bind = _ => new Binding().Add(new BindSearch { Source = "search" })
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(
                @"<div id=""o1"" class=""wx-webapp-permission"" data-page-size=""10"" data-wx-source-search=""#search"" data-wx-source-paging=""#o1_pager"" data-wx-bind=""search,paging""></div><div id=""o1_pager"" class=""wx-webui-pagination""></div>",
                html);
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
            AssertExtensions.EqualWithPlaceholders(@"<div id=""o1"" class=""wx-webapp-permission"" data-page-size=""5"" data-readonly=""true"" data-wx-source-paging=""#o1_pager"" data-wx-bind=""paging""><wx-service hidden name=""data"" kind=""rest"" base-uri=""https://example.com/api/permissions/incident"" method=""GET""></wx-service><wx-service hidden name=""groups"" kind=""rest"" base-uri=""https://example.com/api/groups"" method=""GET""></wx-service><wx-service hidden name=""policies"" kind=""rest"" base-uri=""https://example.com/api/policies"" method=""GET""></wx-service></div><div id=""o1_pager"" class=""wx-webui-pagination""></div>", html);
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
