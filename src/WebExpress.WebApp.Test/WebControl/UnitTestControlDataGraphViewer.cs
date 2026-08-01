using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the api graph viewer control.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlDataGraphViewer
    {
        /// <summary>
        /// Tests the id property of the api graph viewer control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div id=""*"" class=""wx-webapp-graph-viewer"" role=""region""></div>")]
        [InlineData("id", @"<div id=""id"" class=""wx-webapp-graph-viewer"" role=""region""></div>")]
        public void Id(string id, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataGraphViewer(id)
            {
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests that the node and edge styles emit their data attributes only
        /// when they differ from the default the client already applies.
        /// </summary>
        [Theory]
        [InlineData(TypeStyleGraphNode.Default, TypeStyleGraphEdge.Default, @"<div id=""*"" class=""wx-webapp-graph-viewer"" role=""region""></div>")]
        [InlineData(TypeStyleGraphNode.LabelBelow, TypeStyleGraphEdge.Default, @"<div id=""*"" class=""wx-webapp-graph-viewer"" role=""region"" data-node-style=""label-below""></div>")]
        [InlineData(TypeStyleGraphNode.Default, TypeStyleGraphEdge.Smooth, @"<div id=""*"" class=""wx-webapp-graph-viewer"" role=""region"" data-edge-style=""smooth""></div>")]
        [InlineData(TypeStyleGraphNode.LabelBelow, TypeStyleGraphEdge.Straight, @"<div id=""*"" class=""wx-webapp-graph-viewer"" role=""region"" data-node-style=""label-below"" data-edge-style=""straight""></div>")]
        public void Style(TypeStyleGraphNode nodeStyle, TypeStyleGraphEdge edgeStyle, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataGraphViewer()
            {
                NodeStyle = _ => nodeStyle,
                EdgeStyle = _ => edgeStyle
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests that only the opt-out of the layout simulation is emitted, because
        /// the client already enables it unless it reads an explicit "false".
        /// </summary>
        [Theory]
        [InlineData(null, @"<div id=""*"" class=""wx-webapp-graph-viewer"" role=""region""></div>")]
        [InlineData(true, @"<div id=""*"" class=""wx-webapp-graph-viewer"" role=""region""></div>")]
        [InlineData(false, @"<div id=""*"" class=""wx-webapp-graph-viewer"" role=""region"" data-physics-enabled=""false""></div>")]
        public void Physics(bool? physics, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataGraphViewer()
            {
                Physics = physics is null ? null : _ => physics.Value
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests that the grid emits its cell size only when switched on and that
        /// snapping without a grid is dropped rather than emitted as a setting
        /// that has nothing to act on.
        /// </summary>
        [Theory]
        [InlineData(0, false, @"<div id=""*"" class=""wx-webapp-graph-viewer"" role=""region""></div>")]
        [InlineData(0, true, @"<div id=""*"" class=""wx-webapp-graph-viewer"" role=""region""></div>")]
        [InlineData(20, false, @"<div id=""*"" class=""wx-webapp-graph-viewer"" role=""region"" data-grid=""20""></div>")]
        [InlineData(25, true, @"<div id=""*"" class=""wx-webapp-graph-viewer"" role=""region"" data-grid=""25"" data-grid-snap=""true""></div>")]
        public void Grid(int grid, bool snap, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataGraphViewer()
            {
                Grid = _ => grid,
                GridSnap = _ => snap
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests that the accessible name of the canvas is emitted only when set.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div id=""*"" class=""wx-webapp-graph-viewer"" role=""region""></div>")]
        [InlineData("", @"<div id=""*"" class=""wx-webapp-graph-viewer"" role=""region""></div>")]
        [InlineData("Service topology", @"<div id=""*"" class=""wx-webapp-graph-viewer"" role=""region"" data-label=""Service topology""></div>")]
        public void Label(string label, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataGraphViewer()
            {
                Label = _ => label
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }
    }
}
