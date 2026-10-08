using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebApp.WebData;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the relation type administration control. The control only emits
    /// the host element and its island; the table and its editor are built by
    /// the JS controller <c>webexpress.webapp.RelationEditorCtrl</c>.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlDataRelationEditor
    {
        /// <summary>
        /// Tests the id property of the link type control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-relation-editor""></div>")]
        [InlineData("id", @"<div id=""id"" class=""wx-webapp-relation-editor""></div>")]
        public void Id(string id, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataRelationEditor(id);

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests that the data service is emitted as an island, carrying the
        /// filter names the type endpoint reads.
        /// </summary>
        [Fact]
        public void Service_IsEmittedAsIsland()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataRelationEditor()
            {
                ServiceFactory = _ => DataServiceDescriptor.RelationEditorData("https://example.com/api/link-types")
            };

            // act
            var html = control.Render(context, visualTree)?.ToString();

            // validation
            Assert.Contains(@"name=""data""", html);
            Assert.Contains(@"base-uri=""https://example.com/api/link-types""", html);
            Assert.Contains(@"method=""GET""", html);
            Assert.Contains(@"update-method=""PUT""", html);
            Assert.Contains(@"<wx-query name=""class"" wire=""class""", html);
        }

        /// <summary>
        /// Tests that the administered class and the preview sample render into
        /// data attributes.
        /// </summary>
        [Theory]
        [InlineData(null, null, @"<div class=""wx-webapp-relation-editor""></div>")]
        [InlineData("Bug", "BUG-00123", @"<div class=""wx-webapp-relation-editor"" data-class=""Bug"" data-sample=""BUG-00123""></div>")]
        public void ClassAndSample(string cssClass, string sample, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataRelationEditor()
            {
                Class = _ => cssClass,
                Sample = _ => sample
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
        [InlineData(false, @"<div class=""wx-webapp-relation-editor""></div>")]
        [InlineData(true, @"<div class=""wx-webapp-relation-editor"" data-readonly=""true""></div>")]
        public void Readonly(bool readOnly, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataRelationEditor()
            {
                Readonly = _ => readOnly
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Disabled controls must render to <c>null</c> so the page does not
        /// contain an inert administration host.
        /// </summary>
        [Fact]
        public void Enable_False_RendersNothing()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataRelationEditor()
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
