using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the api gantt control.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlDataGantt
    {
        /// <summary>
        /// Tests the id property of the api gantt control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div id=""*"" class=""wx-webapp-gantt""></div>")]
        [InlineData("id", @"<div id=""id"" class=""wx-webapp-gantt""></div>")]
        public void Id(string id, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataGantt(id)
            {
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests that the scale, scales, columns and read-only configuration
        /// emit their data attributes only when set.
        /// </summary>
        [Theory]
        [InlineData(null, null, null, false, @"<div id=""*"" class=""wx-webapp-gantt""></div>")]
        [InlineData("week", null, null, false, @"<div id=""*"" class=""wx-webapp-gantt"" data-scale=""week""></div>")]
        [InlineData(null, "day,week", null, false, @"<div id=""*"" class=""wx-webapp-gantt"" data-scales=""day,week""></div>")]
        [InlineData(null, null, "name,start,duration", false, @"<div id=""*"" class=""wx-webapp-gantt"" data-columns=""name,start,duration""></div>")]
        [InlineData(null, null, null, true, @"<div id=""*"" class=""wx-webapp-gantt"" data-readonly=""true""></div>")]
        [InlineData("month", "day,week,month", "name,progress", true, @"<div id=""*"" class=""wx-webapp-gantt"" data-scale=""month"" data-scales=""day,week,month"" data-columns=""name,progress"" data-readonly=""true""></div>")]
        public void Configuration(string scale, string scales, string columns, bool readOnly, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataGantt()
            {
                Scale = scale is null ? null : _ => scale,
                Scales = scales is null ? null : _ => scales,
                Columns = columns is null ? null : _ => columns,
                ReadOnly = _ => readOnly
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests that the collapsed grid option emits its data attribute only
        /// when true.
        /// </summary>
        [Theory]
        [InlineData(false, @"<div id=""*"" class=""wx-webapp-gantt""></div>")]
        [InlineData(true, @"<div id=""*"" class=""wx-webapp-gantt"" data-grid-collapsed=""true""></div>")]
        public void GridCollapsed(bool collapsed, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataGantt()
            {
                GridCollapsed = _ => collapsed
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests that the fill mode marks the host, which is what makes the shell
        /// hand a height down to the chart instead of letting it keep its own.
        /// </summary>
        [Theory]
        [InlineData(false, @"<div id=""*"" class=""wx-webapp-gantt""></div>")]
        [InlineData(true, @"<div id=""*"" class=""wx-webapp-gantt wx-fill""></div>")]
        public void Fill(bool fill, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataGantt()
            {
                Fill = _ => fill
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }
    }
}
