using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebApp.WebData;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the REST-backed service level agreement. The control renders the
    /// same tile as the static agreement - so the widget is correct before the
    /// endpoint answers - and adds the data islands the JS controller
    /// <c>webexpress.webapp.SlaCtrl</c> resolves its service from.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlDataSla
    {
        /// <summary>
        /// The moment the agreements under test start at.
        /// </summary>
        private static readonly DateTime _start = new(2026, 8, 1, 8, 0, 0);

        /// <summary>
        /// Creates an agreement that grants four hours and is evaluated one hour
        /// into them.
        /// </summary>
        /// <param name="id">The id of the control.</param>
        /// <returns>The control.</returns>
        private static ControlDataSla CreateControl(string id = null)
        {
            return new ControlDataSla(id)
            {
                Start = _ => _start,
                Target = _ => TimeSpan.FromHours(4),
                Now = _ => _start.AddHours(1),
                ShowActions = _ => false
            };
        }

        /// <summary>
        /// Tests that the control renders the tile of the static agreement under
        /// its own marker class, so the two can never disagree about what a
        /// status looks like.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-sla wx-webapp-sla wx-sla-fulfilled""*")]
        [InlineData("id", @"<div id=""id"" class=""wx-sla wx-webapp-sla wx-sla-fulfilled""*")]
        public void Id(string id, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = CreateControl(id);

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests that the seeded state is rendered, which is what keeps the tile
        /// from flashing an empty frame until the endpoint answers.
        /// </summary>
        [Fact]
        public void Seed()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = CreateControl();
            control.Label = _ => "First response";

            // act
            var html = control.Render(context, visualTree).ToString();

            // validation
            Assert.Contains(@"data-status=""fulfilled""", html);
            Assert.Contains(@"data-remaining=""10800""", html);
            Assert.Contains(@"<span class=""wx-sla-label"">First response</span>", html);
        }

        /// <summary>
        /// Tests that the data service is emitted as a wx-service island
        /// carrying the load and the transition method.
        /// </summary>
        [Fact]
        public void Service()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = CreateControl();
            control.ServiceFactory = _ => DataServiceDescriptor.SlaData("https://example.com/api/v1/sla/INC-1");

            // act
            var html = control.Render(context, visualTree).ToString();

            // validation
            Assert.Contains(@"<wx-service hidden name=""data"" kind=""rest"" base-uri=""https://example.com/api/v1/sla/INC-1"" method=""GET"" update-method=""POST""></wx-service>", html);
        }

        /// <summary>
        /// Tests the poll interval, which is what keeps several visitors of the
        /// same agreement in step.
        /// </summary>
        [Theory]
        [InlineData(null, false)]
        [InlineData(30, true)]
        public void RefreshInterval(int? interval, bool expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = CreateControl();
            control.RefreshInterval = _ => interval;

            // act
            var html = control.Render(context, visualTree).ToString();

            // validation
            Assert.Equal(expected, html.Contains(@"data-refresh-interval=""30"""));
        }
    }
}
