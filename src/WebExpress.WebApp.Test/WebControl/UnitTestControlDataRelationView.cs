using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebApp.WebData;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the link surface control. The control only emits the host element
    /// and its islands; the surface itself is built by the JS controller
    /// <c>webexpress.webapp.RelationViewCtrl</c>.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlDataRelationView
    {
        /// <summary>
        /// Tests the id property of the link control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-relation-view""></div>")]
        [InlineData("id", @"<div id=""id"" class=""wx-webapp-relation-view""></div>")]
        public void Id(string id, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataRelationView(id);

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests that the three services of the surface are emitted as islands:
        /// the links, the systems the add dialog offers and the target search.
        /// </summary>
        [Fact]
        public void Services_AreEmittedAsIslands()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataRelationView()
            {
                ServiceFactories =
                {
                    _ => DataServiceDescriptor.RelationViewData("https://example.com/api/links/INC-1"),
                    _ => DataServiceDescriptor.Rest("systems").WithBaseUri("https://example.com/api/link-systems").WithMethod("GET"),
                    _ => DataServiceDescriptor.Rest("targets").WithBaseUri("https://example.com/api/link-targets").WithMethod("GET")
                }
            };

            // act
            var html = control.Render(context, visualTree)?.ToString();

            // validation
            Assert.Contains(@"name=""data""", html);
            Assert.Contains(@"base-uri=""https://example.com/api/links/INC-1""", html);
            Assert.Contains(@"name=""systems""", html);
            Assert.Contains(@"name=""targets""", html);

            // the filter names travel through the island, so the client carries
            // no wire knowledge of its own
            Assert.Contains(@"<wx-query name=""kind"" wire=""kind""", html);
            Assert.Contains(@"<wx-query name=""status"" wire=""status""", html);
            Assert.Contains(@"<wx-query name=""search"" wire=""q""", html);
        }

        /// <summary>
        /// Tests that the object the surface belongs to is emitted, so the add
        /// dialog can state the sentence the link will make.
        /// </summary>
        [Fact]
        public void Subject_RendersIntoDataAttributes()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataRelationView()
            {
                Subject = _ => "INC-00123",
                SubjectClass = _ => "Incident"
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(
                @"<div class=""wx-webapp-relation-view"" data-subject=""INC-00123"" data-subject-class=""Incident""></div>", html);
        }

        /// <summary>
        /// Tests that the presentation the surface opens with is emitted only
        /// when the page states it.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-relation-view""></div>")]
        [InlineData("graph", @"<div class=""wx-webapp-relation-view"" data-view=""graph""></div>")]
        public void View(string view, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataRelationView()
            {
                View = _ => view
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
        [InlineData(false, @"<div class=""wx-webapp-relation-view""></div>")]
        [InlineData(true, @"<div class=""wx-webapp-relation-view"" data-readonly=""true""></div>")]
        public void Readonly(bool readOnly, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataRelationView()
            {
                Readonly = _ => readOnly
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Every part of the header is on unless it was switched off, so only a
        /// surface that suppresses one says so in its markup.
        /// </summary>
        [Fact]
        public void Header_OnByDefault()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataRelationView()
            {
                HeaderIcon = _ => true,
                HeaderText = _ => true,
                HeaderBadge = _ => true
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(@"<div class=""wx-webapp-relation-view""></div>", html);
        }

        /// <summary>
        /// A suppressed part of the header reaches the client as the attribute
        /// that switches it off there.
        /// </summary>
        [Fact]
        public void Header_Suppressed()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataRelationView()
            {
                HeaderIcon = _ => false,
                HeaderText = _ => false,
                HeaderBadge = _ => false
            };

            // act
            var html = control.Render(context, visualTree)?.ToString();

            // validation
            Assert.Contains(@"data-header-icon=""false""", html);
            Assert.Contains(@"data-header-text=""false""", html);
            Assert.Contains(@"data-header-badge=""false""", html);
        }

        /// <summary>
        /// The flat layout drops the card so the surface can sit in a column of
        /// sections; the default keeps it.
        /// </summary>
        [Theory]
        [InlineData(TypeLayoutRelationView.Default, false)]
        [InlineData(TypeLayoutRelationView.Flat, true)]
        public void Layout(TypeLayoutRelationView layout, bool flat)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataRelationView()
            {
                Layout = _ => layout
            };

            // act
            var html = control.Render(context, visualTree)?.ToString();

            // validation
            Assert.Equal(flat, html.Contains("wx-relation-view-flat"));
        }

        /// <summary>
        /// A further presentation added to the surface renders as a hidden pane
        /// carrying the caption and the token of its switch entry, so the client
        /// builds the entry from the pane itself.
        /// </summary>
        [Fact]
        public void Views_RenderAsHiddenPanes()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataRelationView("relations");

            control.Add(new ControlDataRelationViewItem("timeline")
            {
                Label = _ => "Timeline"
            }
                .Add(new ControlText() { Text = _ => "the timeline" }));

            // act
            var html = control.Render(context, visualTree)?.ToString();

            // validation
            Assert.Contains("wx-relation-view-pane", html);
            Assert.Contains("data-view=", html);
            Assert.Contains("timeline", html);
            Assert.Contains("Timeline", html);
            Assert.Contains("hidden", html);
            Assert.Contains("the timeline", html);
        }

        /// <summary>
        /// A presentation without a token cannot be selected, so it is not
        /// rendered at all rather than becoming an unreachable pane.
        /// </summary>
        [Fact]
        public void Views_WithoutAToken_RenderNothing()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataRelationView();

            control.Add(new ControlDataRelationViewItem(null));

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders("<div class=\"wx-webapp-relation-view\"></div>", html);
        }

        /// <summary>
        /// Disabled controls must render to <c>null</c> so the page does not
        /// contain an inert link host.
        /// </summary>
        [Fact]
        public void Enable_False_RendersNothing()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataRelationView()
            {
                Enable = _ => false
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            Assert.Null(html);
        }

        /// <summary>
        /// When bound to a ViewState resource, the control emits only the
        /// <c>data-wx-resource</c> binding and skips its own <c>wx-service</c>
        /// islands, because the enclosing ViewState owns the services and the
        /// central load.
        /// </summary>
        [Fact]
        public void ViewStateBound_EmitsResourceBinding_NotServices()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataRelationView()
            {
                ServiceFactory = _ => DataServiceDescriptor.RelationViewData("https://example.com/api/links/INC-1"),
                ResourceFactory = _ => "links"
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(@"<div class=""wx-webapp-relation-view"" data-wx-resource=""links""></div>", html);
        }

        /// <summary>
        /// The fluent <c>Resource&lt;TResource&gt;()</c> binding sets the resource factory to
        /// the resource type name and preserves the concrete control type for chaining.
        /// </summary>
        [Fact]
        public void Resource_BindsByType_PreservingConcreteType()
        {
            // arrange & act
            ControlDataRelationView control = new ControlDataRelationView("links").Resource<LinksTestResource>();

            // validation
            Assert.Equal(DataTypeName.Of<LinksTestResource>(), control.ResourceFactory(null));
        }

        /// <summary>
        /// A resource identity used only by the binding test.
        /// </summary>
        private sealed class LinksTestResource : IDataResource
        {
        }
    }
}
