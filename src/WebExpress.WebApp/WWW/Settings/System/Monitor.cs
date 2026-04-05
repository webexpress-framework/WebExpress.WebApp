using System;
using System.Collections.Generic;
using System.Linq;
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
            // visual container for the page content
            var panel = visualTree.Content.MainPanel;

            // add a title for the general statistics section
            panel.AddPrimary(new ControlText()
            {
                Text = I18N.Translate(renderContext, "webexpress.webapp:setting.monitor.group.statistics.label"),
                TextColor = new PropertyColorText(TypeColorText.Info),
                Margin = new PropertySpacingMargin(PropertySpacing.Space.Two)
            });

            // create a table to display scalar metric values
            var statsTable = new ControlTable()
            {
                Striped = TypeStripedTable.Row,
                SuppressHeaders = true
            };

            statsTable.AddColumn("");
            statsTable.AddColumn("");

            // add current system time row
            statsTable.AddRow
            (
                new ControlTableCell()
                {
                    Text = I18N.Translate(renderContext, "webexpress.webapp:setting.monitor.currenttime")
                },
                new ControlTableCellPanel().Add(new ControlText()
                {
                    Text = DateTime.Now.ToString(renderContext.Request.Culture),
                    Format = TypeFormatText.Code
                })
            );

            // add uptime row
            statsTable.AddRow
            (
                new ControlTableCell()
                {
                    Text = I18N.Translate(renderContext, "webexpress.webapp:setting.monitor.uptime")
                },
                new ControlTableCellPanel().Add(new ControlText()
                {
                    Text = (DateTime.Now - WebExpress.WebCore.HttpServer.ExecutionTime).ToString(@"dd\.hh\:mm\:ss"),
                    Format = TypeFormatText.Code
                })
            );

            // add total requests row
            var totalRequests = 0;
            lock (WebExpress.WebCore.HttpServer.Statistics)
            {
                totalRequests = WebExpress.WebCore.HttpServer.Statistics.Sum(x => x.Requests);
            }

            statsTable.AddRow
            (
                new ControlTableCell()
                {
                    Text = I18N.Translate(renderContext, "webexpress.webapp:setting.monitor.totalrequests")
                },
                new ControlTableCellPanel().Add(new ControlText()
                {
                    Text = totalRequests.ToString(),
                    Format = TypeFormatText.Code
                })
            );

            panel.AddPrimary(statsTable);

            // create a copy of the statistics to avoid modification issues during enumeration
            List<HttpServerStatisticItem> statistics;
            lock (HttpServer.Statistics)
            {
                statistics = [.. HttpServer.Statistics];
            }

            // prepare data lists
            var labels = new List<string>();
            var dataRequests = new ControlChartDatasetPointCollection([.. statistics.Select(x => x.Requests)]);
            var dataErrors = new ControlChartDatasetPointCollection([.. statistics.Select(x => x.Errors)]);
            var dataMin = new ControlChartDatasetPointCollection([.. statistics.Select(x => x.MinDuration)]);
            var dataMax = new ControlChartDatasetPointCollection([.. statistics.Select(x => x.MaxDuration)]);
            var dataAvg = new ControlChartDatasetPointCollection([.. statistics.Select(x => (float)x.AverageDuration)]);
            var dataCpu = new ControlChartDatasetPointCollection([.. statistics.Select(x => (float)x.CpuUsage)]);
            var dataMem = new ControlChartDatasetPointCollection([.. statistics.Select(x => (float)x.MemoryUsage)]);

            // fill labels
            foreach (var item in statistics)
            {
                labels.Add(item.Timestamp.ToString("HH:mm"));
            }

            // chart 1: traffic (requests and errors)
            panel.AddPrimary(new ControlText()
            {
                Text = I18N.Translate(renderContext, "webexpress.webapp:setting.monitor.group.chart.traffic.label"),
                TextColor = new PropertyColorText(TypeColorText.Info),
                Margin = new PropertySpacingMargin(PropertySpacing.Space.Two)
            });

            var chartTraffic = new ControlChart()
            {
                Type = TypeChart.Line,
                Height = 300,
                Responsive = true,
                MaintainAspectRatio = false,
                TitleDisplay = false,
                LegendDisplay = true,
                YBeginAtZero = true
            };

            chartTraffic.AddLabel(labels);

            chartTraffic.AddDataset(new ControlChartDataset()
            {
                Title = I18N.Translate(renderContext, "webexpress.webapp:setting.monitor.dataset.requests"),
                Data = dataRequests,
                BorderColor = "#007bff", // primary blue
                BackgroundColor = "rgba(0, 123, 255, 0.1)",
                BorderWidth = 2,
                Fill = TypeFillChart.Origin
            });

            chartTraffic.AddDataset(new ControlChartDataset()
            {
                Title = I18N.Translate(renderContext, "webexpress.webapp:setting.monitor.dataset.errors"),
                Data = dataErrors,
                BorderColor = "#dc3545", // danger red
                BackgroundColor = "rgba(220, 53, 69, 0.1)",
                BorderWidth = 2,
                Fill = TypeFillChart.Origin
            });

            panel.AddPrimary(chartTraffic);

            // chart 2: performance (duration in ms)
            panel.AddPrimary(new ControlText()
            {
                Text = I18N.Translate(renderContext, "webexpress.webapp:setting.monitor.group.chart.performance.label"),
                TextColor = new PropertyColorText(TypeColorText.Info),
                Margin = new PropertySpacingMargin(PropertySpacing.Space.Two)
            });

            var chartPerformance = new ControlChart()
            {
                Type = TypeChart.Line,
                Height = 300,
                Responsive = true,
                MaintainAspectRatio = false,
                TitleDisplay = false,
                LegendDisplay = true,
                YBeginAtZero = true
            };

            chartPerformance.AddLabel(labels);

            chartPerformance.AddDataset(new ControlChartDataset()
            {
                Title = I18N.Translate(renderContext, "webexpress.webapp:setting.monitor.dataset.avg_duration"),
                Data = dataAvg,
                BorderColor = "#28a745", // success green
                BackgroundColor = "rgba(40, 167, 69, 0.1)",
                BorderWidth = 2,
                Point = TypePointChart.Rect
            });

            chartPerformance.AddDataset(new ControlChartDataset()
            {
                Title = I18N.Translate(renderContext, "webexpress.webapp:setting.monitor.dataset.max_duration"),
                Data = dataMax,
                BorderColor = "#ffc107", // warning yellow
                BackgroundColor = "rgba(255, 193, 7, 0.1)",
                BorderWidth = 2
            });

            chartPerformance.AddDataset(new ControlChartDataset()
            {
                Title = I18N.Translate(renderContext, "webexpress.webapp:setting.monitor.dataset.min_duration"),
                Data = dataMin,
                BorderColor = "#ff6000", // orange
                BackgroundColor = "rgba(255, 96, 0, 0.1)",
                BorderWidth = 2
            });

            panel.AddPrimary(chartPerformance);

            // chart 3: resources (cpu % and memory mb)
            panel.AddPrimary(new ControlText()
            {
                Text = I18N.Translate(renderContext, "webexpress.webapp:setting.monitor.group.chart.resources.label"),
                TextColor = new PropertyColorText(TypeColorText.Info),
                Margin = new PropertySpacingMargin(PropertySpacing.Space.Two)
            });

            var chartResources = new ControlChart()
            {
                Type = TypeChart.Line,
                Height = 300,
                Responsive = true,
                MaintainAspectRatio = false,
                TitleDisplay = false,
                LegendDisplay = true,
                YBeginAtZero = true
            };

            chartResources.AddLabel(labels);

            chartResources.AddDataset(new ControlChartDataset()
            {
                Title = I18N.Translate(renderContext, "webexpress.webapp:setting.monitor.dataset.cpu"),
                Data = dataCpu,
                BorderColor = "#6f42c1", // purple
                BackgroundColor = "rgba(111, 66, 193, 0.1)",
                BorderWidth = 2,
                Fill = TypeFillChart.Origin
            });

            chartResources.AddDataset(new ControlChartDataset()
            {
                Title = I18N.Translate(renderContext, "webexpress.webapp:setting.monitor.dataset.memory"),
                Data = dataMem,
                BorderColor = "#17a2b8", // info cyan
                BackgroundColor = "rgba(23, 162, 184, 0.1)",
                BorderWidth = 2
            });

            panel.AddPrimary(chartResources);
        }
    }
}