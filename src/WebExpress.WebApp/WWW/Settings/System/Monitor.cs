using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using WebExpress.WebApp.WebControl;
using WebExpress.WebApp.WebScope;
using WebExpress.WebApp.WebSettingPage;
using WebExpress.WebCore;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebPage;
using WebExpress.WebCore.WebSettingPage;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebIcon;

namespace WebExpress.WebApp.WWW.Settings.System
{
    /// <summary>
    /// Settings page for monitoring system requests and responses.
    /// </summary>
    [WebIcon<IconChartLine>]
    [Title("webexpress.webapp:setting.monitor.title.label")]
    [SettingGroup<SettingGroupSystemGeneral>()]
    [SettingSection(SettingSection.Secondary)]
    [Scope<IScopeAdmin>]
    public sealed class Monitor : ISettingPage<VisualTreeWebAppSetting>, IScopeAdmin
    {
        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        public Monitor()
        {
        }

        /// <summary>
        /// Processing of the resource.
        /// </summary>
        /// <param name="renderContext">The context for rendering the page.</param>
        /// <param name="visualTree">The visual tree of the web application.</param>
        public void Process(IRenderContext renderContext, VisualTreeWebAppSetting visualTree)
        {
            var panel = visualTree.Content.MainPanel;

            // a copy taken under the lock: the request pipeline keeps appending to the
            // collection while the page renders
            List<HttpServerStatisticItem> statistics;
            lock (HttpServer.Statistics)
            {
                statistics = [.. HttpServer.Statistics];
            }

            panel.AddPrimary(CreateSectionTitle(renderContext, "webexpress.webapp:setting.monitor.group.statistics.label"));
            panel.AddPrimary(CreateSummary(renderContext, statistics));

            // the gauges subscribe to the message queue and keep updating on their own, so
            // the current load stays true while the charts below remain the snapshot the
            // page was rendered from
            panel.AddPrimary(CreateSectionTitle(renderContext, "webexpress.webapp:setting.monitor.group.load.label"));
            panel.AddPrimary(new ControlPanel()
            {
                Classes = ["d-flex", "flex-wrap", "gap-4", "m-2"]
            }
                .Add
                (
                    new ControlSystemMetric()
                    {
                        Metric = _ => TypeSystemMetric.Cpu,
                        Label = _ => I18N.Translate(renderContext, "webexpress.webapp:setting.monitor.dataset.cpu")
                    },
                    new ControlSystemMetric()
                    {
                        Metric = _ => TypeSystemMetric.Ram,
                        Label = _ => I18N.Translate(renderContext, "webexpress.webapp:setting.monitor.dataset.memory")
                    }
                ));

            if (statistics.Count == 0)
            {
                panel.AddPrimary(new ControlEmptyState()
                {
                    Icon = _ => new IconChartLine(),
                    Title = _ => I18N.Translate(renderContext, "webexpress.webapp:setting.monitor.empty.title"),
                    Message = _ => I18N.Translate(renderContext, "webexpress.webapp:setting.monitor.empty.message")
                });

                return;
            }

            var labels = statistics.Select(x => x.Timestamp.ToString("HH:mm")).ToList();
            var time = I18N.Translate(renderContext, "webexpress.webapp:setting.monitor.chart.axis.x");

            panel.AddPrimary(CreateSectionTitle(renderContext, "webexpress.webapp:setting.monitor.group.chart.traffic.label"));
            panel.AddPrimary(CreateChart
            (
                labels,
                time,
                I18N.Translate(renderContext, "webexpress.webapp:setting.monitor.chart.axis.y"),
                CreateDataset(I18N.Translate(renderContext, "webexpress.webapp:setting.monitor.dataset.requests"), statistics.Select(x => (float)x.Requests), "#007bff", true),
                CreateDataset(I18N.Translate(renderContext, "webexpress.webapp:setting.monitor.dataset.errors"), statistics.Select(x => (float)x.Errors), "#dc3545", true)
            ));

            panel.AddPrimary(CreateSectionTitle(renderContext, "webexpress.webapp:setting.monitor.group.chart.performance.label"));
            panel.AddPrimary(CreateChart
            (
                labels,
                time,
                I18N.Translate(renderContext, "webexpress.webapp:setting.monitor.axis.duration"),
                CreateDataset(I18N.Translate(renderContext, "webexpress.webapp:setting.monitor.dataset.avg_duration"), statistics.Select(x => (float)x.AverageDuration), "#28a745"),
                CreateDataset(I18N.Translate(renderContext, "webexpress.webapp:setting.monitor.dataset.max_duration"), statistics.Select(x => (float)x.MaxDuration), "#ffc107"),
                CreateDataset(I18N.Translate(renderContext, "webexpress.webapp:setting.monitor.dataset.min_duration"), statistics.Select(x => (float)x.MinDuration), "#ff6000")
            ));

            // cpu and memory get a chart each: a percentage and a megabyte reading on one
            // axis would scale each other into a flat line
            panel.AddPrimary(CreateSectionTitle(renderContext, "webexpress.webapp:setting.monitor.group.chart.resources.label"));
            panel.AddPrimary(CreateChart
            (
                labels,
                time,
                I18N.Translate(renderContext, "webexpress.webapp:setting.monitor.axis.percent"),
                CreateDataset(I18N.Translate(renderContext, "webexpress.webapp:setting.monitor.dataset.cpu"), statistics.Select(x => (float)x.CpuUsage), "#6f42c1", true)
            ));

            panel.AddPrimary(CreateChart
            (
                labels,
                time,
                I18N.Translate(renderContext, "webexpress.webapp:setting.monitor.axis.megabyte"),
                CreateDataset(I18N.Translate(renderContext, "webexpress.webapp:setting.monitor.dataset.memory"), statistics.Select(x => (float)x.MemoryUsage), "#17a2b8", true)
            ));
        }

        /// <summary>
        /// Creates the row of key figures shown above the charts. It answers the questions an
        /// operator opens the page with - how long has the server been up, how much has it
        /// served, how much of it failed and how fast was it - before they read any curve.
        /// </summary>
        /// <param name="renderContext">The render context.</param>
        /// <param name="statistics">The collected statistics.</param>
        /// <returns>The summary panel.</returns>
        private static ControlPanel CreateSummary(IRenderContext renderContext, IEnumerable<HttpServerStatisticItem> statistics)
        {
            var culture = renderContext.Request.Culture;
            var requests = statistics.Sum(x => x.Requests);
            var errors = statistics.Sum(x => x.Errors);
            var duration = requests > 0 ? (double)statistics.Sum(x => x.TotalDuration) / requests : 0;
            var errorRate = requests > 0 ? errors * 100d / requests : 0;

            var summary = new ControlPanel()
            {
                Classes = ["d-flex", "flex-wrap", "gap-2", "m-2"]
            };

            summary.Add
                (
                    new ControlStat()
                    {
                        Icon = _ => new IconClock(),
                        Label = _ => I18N.Translate(renderContext, "webexpress.webapp:setting.monitor.currenttime"),
                        Value = _ => DateTime.Now.ToString("T", culture)
                    },
                    new ControlStat()
                    {
                        Icon = _ => new IconHourglass(),
                        Label = _ => I18N.Translate(renderContext, "webexpress.webapp:setting.monitor.uptime"),
                        Value = _ => (DateTime.Now - HttpServer.ExecutionTime).ToString(@"dd\.hh\:mm\:ss")
                    },
                    new ControlStat()
                    {
                        Icon = _ => new IconRightLeft(),
                        Label = _ => I18N.Translate(renderContext, "webexpress.webapp:setting.monitor.totalrequests"),
                        Value = _ => requests.ToString("N0", culture)
                    },
                    new ControlStat()
                    {
                        Icon = _ => new IconTriangleExclamation(),
                        Label = _ => I18N.Translate(renderContext, "webexpress.webapp:setting.monitor.dataset.errors"),
                        Value = _ => errors.ToString("N0", culture),
                        Delta = _ => string.Format
                        (
                            I18N.Translate(renderContext, "webexpress.webapp:setting.monitor.errorrate"),
                            errorRate.ToString("N1", culture)
                        ),
                        // a failing server is the finding, so any error rate is called out in
                        // the negative color and a clean one stays quiet rather than positive
                        Trend = _ => errors > 0 ? TypeStatTrend.Down : TypeStatTrend.Neutral
                    },
                    new ControlStat()
                    {
                        Icon = _ => new IconStopwatch(),
                        Label = _ => I18N.Translate(renderContext, "webexpress.webapp:setting.monitor.avgresponse"),
                        Value = _ => string.Format
                        (
                            I18N.Translate(renderContext, "webexpress.webapp:setting.monitor.millisecond"),
                            duration.ToString("N0", culture)
                        )
                    }
                );

            return summary;
        }

        /// <summary>
        /// Creates the caption that introduces a section.
        /// </summary>
        /// <param name="renderContext">The render context.</param>
        /// <param name="key">The internationalization key of the caption.</param>
        /// <returns>The caption control.</returns>
        private static ControlText CreateSectionTitle(IRenderContext renderContext, string key)
        {
            return new ControlText()
            {
                Text = _ => I18N.Translate(renderContext, key),
                TextColor = _ => new PropertyColorText(TypeColorText.Info),
                Margin = _ => new PropertySpacingMargin(PropertySpacing.Space.Two)
            };
        }

        /// <summary>
        /// Creates a time series chart over the collected intervals.
        /// </summary>
        /// <param name="labels">The interval labels.</param>
        /// <param name="titleX">The caption of the time axis.</param>
        /// <param name="titleY">The caption of the value axis, which names the unit.</param>
        /// <param name="datasets">The series to plot.</param>
        /// <returns>The chart control.</returns>
        private static ControlChart CreateChart(IEnumerable<string> labels, string titleX, string titleY, params ControlChartDataset[] datasets)
        {
            var chart = new ControlChart()
            {
                Type = _ => TypeChart.Line,
                Height = _ => 300,
                Responsive = _ => true,
                MaintainAspectRatio = _ => false,
                TitleDisplay = _ => false,
                LegendDisplay = _ => true,
                YBeginAtZero = _ => true,
                TitleX = _ => titleX,
                TitleY = _ => titleY
            };

            chart.AddLabel(labels);
            chart.AddDataset(datasets);

            return chart;
        }

        /// <summary>
        /// Creates a chart series.
        /// </summary>
        /// <remarks>
        /// The fill color is derived from the line color rather than passed separately, so a
        /// series cannot end up drawn in one color and filled in another.
        /// </remarks>
        /// <param name="title">The legend entry.</param>
        /// <param name="values">The values, one per interval.</param>
        /// <param name="color">The line color as a hex triplet.</param>
        /// <param name="fill">Whether the area below the line is filled.</param>
        /// <returns>The dataset.</returns>
        private static ControlChartDataset CreateDataset(string title, IEnumerable<float> values, string color, bool fill = false)
        {
            return new ControlChartDataset()
            {
                Title = title,
                Data = new ControlChartDatasetPointCollection([.. values]),
                BorderColor = color,
                BackgroundColor = ToTransparent(color),
                BorderWidth = 2,
                Fill = fill ? TypeFillChart.Origin : TypeFillChart.None
            };
        }

        /// <summary>
        /// Converts a hex color triplet into the translucent rgba notation used for the area
        /// below a line.
        /// </summary>
        /// <param name="color">The color as "#rrggbb".</param>
        /// <returns>The color as an rgba string.</returns>
        private static string ToTransparent(string color)
        {
            var red = int.Parse(color.Substring(1, 2), NumberStyles.HexNumber, CultureInfo.InvariantCulture);
            var green = int.Parse(color.Substring(3, 2), NumberStyles.HexNumber, CultureInfo.InvariantCulture);
            var blue = int.Parse(color.Substring(5, 2), NumberStyles.HexNumber, CultureInfo.InvariantCulture);

            return $"rgba({red}, {green}, {blue}, 0.1)";
        }
    }
}
