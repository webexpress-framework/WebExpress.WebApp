using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebData;
using WebExpress.WebApp.WebControl;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the threaded comment control. The control only emits the
    /// host element; the actual rendering happens in the JS controller
    /// <c>webexpress.webapp.CommentCtrl</c>.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlComment
    {
        /// <summary>
        /// Tests the id property of the comment control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-comment""></div>")]
        [InlineData("id", @"<div id=""id"" class=""wx-webapp-comment""></div>")]
        [InlineData("87BD7E47-9D08-4DAB-BFFE-DA2B2DD12C3B", @"<div id=""87BD7E47-9D08-4DAB-BFFE-DA2B2DD12C3B"" class=""wx-webapp-comment""></div>")]
        public void Id(string id, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataComment(id)
            {
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }


        /// <summary>
        /// Tests the UsersUri property of the comment control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-comment""></div>")]
        [InlineData("https://example.com/api/users", @"<div class=""wx-webapp-comment""><wx-service hidden name=""users"" kind=""rest"" base-uri=""https://example.com/api/users"" method=""GET""></wx-service></div>")]
        public void UsersUri(string uriString, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataComment()
            {
                ServiceFactory = uriString is not null ? _ => DataServiceDescriptor.Rest("users").WithBaseUri(uriString).WithMethod("GET") : null
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests that the CurrentUser property renders into the
        /// <c>data-current-user</c> attribute.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-comment""></div>")]
        [InlineData("", @"<div class=""wx-webapp-comment""></div>")]
        [InlineData("u1", @"<div class=""wx-webapp-comment"" data-current-user=""u1""></div>")]
        public void CurrentUser(string user, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataComment()
            {
                CurrentUser = _ => user
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
        [InlineData(false, @"<div class=""wx-webapp-comment""></div>")]
        [InlineData(true, @"<div class=""wx-webapp-comment"" data-readonly=""true""></div>")]
        public void Readonly(bool readOnly, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataComment()
            {
                Readonly = _ => readOnly
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests that the ImageUploadUri renders into the
        /// <c>data-image-upload-uri</c> attribute.
        /// </summary>
        [Fact]
        public void ImageUploadUri()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataComment()
            {
                ServiceFactory = _ => DataServiceDescriptor.Rest("upload").WithBaseUri("https://example.com/api/upload").WithMethod("POST")
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(@"<div class=""wx-webapp-comment""><wx-service hidden name=""upload"" kind=""rest"" base-uri=""https://example.com/api/upload"" method=""POST""></wx-service></div>", html);
        }

        /// <summary>
        /// Tests that a categories JSON override is forwarded verbatim into
        /// the <c>data-categories</c> attribute.
        /// </summary>
        [Fact]
        public void Categories()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataComment("c")
            {
                Categories = _ => "{\"general\":{\"id\":\"general\"}}"
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(@"<div id=""c"" class=""wx-webapp-comment"" data-categories=""{&quot;general&quot;:{&quot;id&quot;:&quot;general&quot;}}""></div>", html);
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
            var control = new ControlDataComment("c1")
            {
                ServiceFactories =
                {
                    _ => DataServiceDescriptor.Rest("users").WithBaseUri("https://example.com/api/users").WithMethod("GET"),
                    _ => DataServiceDescriptor.Rest("upload").WithBaseUri("https://example.com/api/upload").WithMethod("POST")
                },
                CurrentUser = _ => "u-alice",
                Readonly = _ => false
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(@"<div id=""c1"" class=""wx-webapp-comment"" data-current-user=""u-alice""><wx-service hidden name=""users"" kind=""rest"" base-uri=""https://example.com/api/users"" method=""GET""></wx-service><wx-service hidden name=""upload"" kind=""rest"" base-uri=""https://example.com/api/upload"" method=""POST""></wx-service></div>", html);
        }

        /// <summary>
        /// Disabled controls must render to <c>null</c> so the page does
        /// not contain an inert comment host.
        /// </summary>
        [Fact]
        public void Enable_False_RendersNothing()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataComment()
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
