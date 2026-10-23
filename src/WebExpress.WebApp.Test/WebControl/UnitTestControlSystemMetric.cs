using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the WebSocket-driven system metric gauge control.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlSystemMetric
    {
        /// <summary>
        /// Tests the id property of the system metric control. The cpu default
        /// is always seeded, so the client subscribes a channel even without an
        /// explicit metric.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div id=""*"" class=""wx-webapp-system-metric"" data-metric=""cpu""></div>")]
        [InlineData("id", @"<div id=""id"" class=""wx-webapp-system-metric"" data-metric=""cpu""></div>")]
        public void Id(string id, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlSystemMetric(id);

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the Metric property - the rendered host element must carry the
        /// wire token of the metric as a <c>data-metric</c> attribute so the
        /// JavaScript controller subscribes the right channel and filters the
        /// incoming readings.
        /// </summary>
        [Theory]
        [InlineData(TypeSystemMetric.Cpu, @"<div id=""*"" class=""wx-webapp-system-metric"" data-metric=""cpu""></div>")]
        [InlineData(TypeSystemMetric.Ram, @"<div id=""*"" class=""wx-webapp-system-metric"" data-metric=""ram""></div>")]
        public void Metric(TypeSystemMetric metric, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlSystemMetric()
            {
                Metric = _ => metric
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the Layout property - only the non-default chart layout is
        /// seeded into the <c>data-layout</c> attribute, so the implicit bar
        /// layout stays off the wire.
        /// </summary>
        [Theory]
        [InlineData(TypeSystemMetricLayout.Bar, @"<div id=""*"" class=""wx-webapp-system-metric"" data-metric=""cpu""></div>")]
        [InlineData(TypeSystemMetricLayout.Chart, @"<div id=""*"" class=""wx-webapp-system-metric"" data-metric=""cpu"" data-layout=""chart""></div>")]
        public void LayoutProperty(TypeSystemMetricLayout layout, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlSystemMetric()
            {
                Layout = _ => layout
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the Label property - the caption is seeded into the
        /// <c>data-label</c> attribute; without a label the client falls back to
        /// the translated metric name.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div id=""*"" class=""wx-webapp-system-metric"" data-metric=""cpu""></div>")]
        [InlineData("Server load", @"<div id=""*"" class=""wx-webapp-system-metric"" data-metric=""cpu"" data-label=""Server load""></div>")]
        public void Label(string label, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlSystemMetric()
            {
                Label = _ => label
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests that the metric tokens are the stable wire values the server
        /// and the client agree on.
        /// </summary>
        [Theory]
        [InlineData(TypeSystemMetric.Cpu, "cpu")]
        [InlineData(TypeSystemMetric.Ram, "ram")]
        public void ToValue(TypeSystemMetric metric, string expected)
        {
            Assert.Equal(expected, metric.ToValue());
        }

        /// <summary>
        /// Tests that the layout tokens are the stable wire values the client
        /// matches against.
        /// </summary>
        [Theory]
        [InlineData(TypeSystemMetricLayout.Bar, "bar")]
        [InlineData(TypeSystemMetricLayout.Chart, "chart")]
        public void LayoutToValue(TypeSystemMetricLayout layout, string expected)
        {
            Assert.Equal(expected, layout.ToValue());
        }
    }
}
