using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebApp.WebData;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the scrum velocity control. The control only emits the host element;
    /// the bar chart is built by the JS controller
    /// <c>webexpress.webapp.ScrumVelocityCtrl</c>.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlDataScrumVelocity
    {
        /// <summary>
        /// Tests the id property of the scrum velocity control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-scrum-velocity""></div>")]
        [InlineData("id", @"<div id=""id"" class=""wx-webapp-scrum-velocity""></div>")]
        [InlineData("87BD7E47-9D08-4DAB-BFFE-DA2B2DD12C3B", @"<div id=""87BD7E47-9D08-4DAB-BFFE-DA2B2DD12C3B"" class=""wx-webapp-scrum-velocity""></div>")]
        public void Id(string id, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataScrumVelocity(id);

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the data service of the scrum velocity control, which loads the
        /// recent sprints with a single GET.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-scrum-velocity""></div>")]
        [InlineData("https://example.com/api/scrum/velocity", @"<div class=""wx-webapp-scrum-velocity""><wx-service hidden name=""data"" kind=""rest"" base-uri=""https://example.com/api/scrum/velocity"" method=""GET""></wx-service></div>")]
        public void Service(string uriString, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataScrumVelocity()
            {
                ServiceFactory = uriString is not null ? _ => DataServiceDescriptor.QueryData(uriString) : null
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests that the MaxSprints property renders into the
        /// <c>data-max-sprints</c> attribute.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-scrum-velocity""></div>")]
        [InlineData(8, @"<div class=""wx-webapp-scrum-velocity"" data-max-sprints=""8""></div>")]
        public void MaxSprints(int? maxSprints, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataScrumVelocity()
            {
                MaxSprints = _ => maxSprints
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests that the sprint filter is opt-in: it renders into the
        /// <c>data-show-sprint-filter</c> attribute only when switched on, so a
        /// chart that was never asked for it stays a read-only tile.
        /// </summary>
        [Theory]
        [InlineData(false, @"<div class=""wx-webapp-scrum-velocity""></div>")]
        [InlineData(true, @"<div class=""wx-webapp-scrum-velocity"" data-show-sprint-filter=""true""></div>")]
        public void ShowSprintFilter(bool showSprintFilter, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataScrumVelocity()
            {
                ShowSprintFilter = _ => showSprintFilter
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the id, the data service, the MaxSprints attribute and the
        /// sprint filter rendering together.
        /// </summary>
        [Fact]
        public void AllAttributes()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataScrumVelocity("v1")
            {
                ServiceFactory = _ => DataServiceDescriptor.QueryData("https://example.com/api/scrum/velocity"),
                MaxSprints = _ => 6,
                ShowSprintFilter = _ => true
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(@"<div id=""v1"" class=""wx-webapp-scrum-velocity"" data-max-sprints=""6"" data-show-sprint-filter=""true""><wx-service hidden name=""data"" kind=""rest"" base-uri=""https://example.com/api/scrum/velocity"" method=""GET""></wx-service></div>", html);
        }

        /// <summary>
        /// Tests that a system color renders as a CSS class and a user-defined
        /// color renders as an inline style, exactly like a control button.
        /// </summary>
        [Fact]
        public void Colors()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataScrumVelocity()
            {
                ColorCompleted = _ => new PropertyColorBackground(TypeColorBackground.Success),
                ColorCommitted = _ => new PropertyColorBackground("#dddddd"),
                ColorAverage = _ => new PropertyColorBackground(TypeColorBackground.Danger)
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(@"<div class=""wx-webapp-scrum-velocity"" data-color-completed-css=""bg-success"" data-color-committed-style=""background:#dddddd;"" data-color-average-css=""bg-danger""></div>", html);
        }

        /// <summary>
        /// Disabled controls must render to <c>null</c> so the page does not
        /// contain an inert velocity host.
        /// </summary>
        [Fact]
        public void Enable_False_RendersNothing()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataScrumVelocity()
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
        /// island, because the enclosing ViewState owns the service and the central load.
        /// </summary>
        [Fact]
        public void ViewStateBound_EmitsResourceBinding_NotService()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataScrumVelocity()
            {
                // even with a service declared, the resource binding wins
                ServiceFactory = _ => DataServiceDescriptor.QueryData("https://example.com/api/scrum/velocity"),
                ResourceFactory = _ => "velocity"
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(@"<div class=""wx-webapp-scrum-velocity"" data-wx-resource=""velocity""></div>", html);
        }

        /// <summary>
        /// The fluent <c>Resource&lt;TResource&gt;()</c> binding sets the resource factory to the
        /// resource type name and preserves the concrete control type for chaining.
        /// </summary>
        [Fact]
        public void Resource_BindsByType_PreservingConcreteType()
        {
            // arrange & act: the assignment compiles only because the typed overload returns the
            // concrete control type rather than IViewStateBound
            ControlDataScrumVelocity control = new ControlDataScrumVelocity("velocity").Resource<VelocityTestResource>();

            // validation
            Assert.Equal(DataTypeName.Of<VelocityTestResource>(), control.ResourceFactory(null));
        }

        /// <summary>
        /// A resource identity used only by the binding test.
        /// </summary>
        private sealed class VelocityTestResource : IDataResource
        {
        }
    }
}
