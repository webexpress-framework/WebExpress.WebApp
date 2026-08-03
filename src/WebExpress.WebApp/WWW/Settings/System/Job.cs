using System.Collections.Generic;
using System.Linq;
using WebExpress.WebApp.WebScope;
using WebExpress.WebApp.WebSettingPage;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebComponent;
using WebExpress.WebCore.WebJob;
using WebExpress.WebCore.WebPage;
using WebExpress.WebCore.WebSettingPage;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebIcon;

namespace WebExpress.WebApp.WWW.Settings.System
{
    /// <summary>
    /// Settings page listing the scheduled jobs of the server.
    /// </summary>
    /// <remarks>
    /// A job runs unattended, so the only way to tell a scheduler that has nothing to do from
    /// one that was never given anything is to see the registered schedules. The page lists
    /// them with the schedule rendered back into cron notation.
    /// </remarks>
    [WebIcon<IconClock>]
    [Title("webexpress.webapp:setting.title.job.label")]
    [SettingGroup<SettingGroupSystemGeneral>()]
    [SettingSection(SettingSection.Secondary)]
    [Scope<IScopeAdmin>]
    public sealed class Job : ISettingPage<VisualTreeWebAppSetting>, IScopeAdmin
    {
        private readonly IComponentHub _componentHub;

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="componentHub">The component hub.</param>
        public Job(IComponentHub componentHub)
        {
            _componentHub = componentHub;
        }

        /// <summary>
        /// Processing of the resource.
        /// </summary>
        /// <param name="renderContext">The context for rendering the page.</param>
        /// <param name="visualTree">The visual tree of the web application.</param>
        public void Process(IRenderContext renderContext, VisualTreeWebAppSetting visualTree)
        {
            var panel = visualTree.Content.MainPanel;
            var jobs = _componentHub?.JobManager.Jobs
                .OrderBy(x => x.JobId?.ToString())
                .ToList() ?? [];

            panel.AddPrimary(new ControlText()
            {
                Text = _ => I18N.Translate(renderContext, "webexpress.webapp:setting.job.description"),
                Margin = _ => new PropertySpacingMargin(PropertySpacing.Space.Two)
            });

            if (jobs.Count == 0)
            {
                panel.AddPrimary(new ControlEmptyState()
                {
                    Icon = _ => new IconClock(),
                    Title = _ => I18N.Translate(renderContext, "webexpress.webapp:setting.job.empty.title"),
                    Message = _ => I18N.Translate(renderContext, "webexpress.webapp:setting.job.empty.message")
                });

                return;
            }

            var table = new ControlTable() { Striped = _ => TypeStripedTable.Row };
            table.AddColumn(I18N.Translate(renderContext, "webexpress.webapp:setting.job.name.label"));
            table.AddColumn(I18N.Translate(renderContext, "webexpress.webapp:setting.job.schedule.label"));
            table.AddColumn(I18N.Translate(renderContext, "webexpress.webapp:setting.job.plugin.label"));
            table.AddColumn(I18N.Translate(renderContext, "webexpress.webapp:setting.job.application.label"));

            table.AddRows(jobs.Select(x => CreateRow(renderContext, x)));

            panel.AddPrimary(table);
        }

        /// <summary>
        /// Creates the table row of a single job.
        /// </summary>
        /// <param name="renderContext">The render context.</param>
        /// <param name="jobContext">The job.</param>
        /// <returns>The row.</returns>
        private static ControlTableRow CreateRow(IRenderContext renderContext, IJobContext jobContext)
        {
            var row = new ControlTableRow()
            {
                Icon = _ => new IconClock()
            };

            var id = jobContext.JobId?.ToString();
            var name = I18N.Translate(renderContext, jobContext.JobName);
            var description = I18N.Translate(renderContext, jobContext.Description);

            row.Add
            (
                new ControlTableCellPanel() { Class = _ => "wx-table-cell-stack" }.Add
                (
                    new ControlText()
                    {
                        Text = _ => !string.IsNullOrWhiteSpace(name) ? name : id,
                        Format = _ => TypeFormatText.Bold,
                        // the id is what the log writes, so it stays reachable even once a
                        // readable name has taken its place
                        Title = _ => id
                    },
                    new ControlText()
                    {
                        Text = _ => !string.IsNullOrWhiteSpace(description) ? description : id,
                        Format = _ => TypeFormatText.Default,
                        TextColor = _ => new PropertyColorText(TypeColorText.Secondary),
                        Size = _ => new PropertySizeText(TypeSizeText.Small)
                    }
                ),
                new ControlTableCell()
                {
                    Text = _ => Format(jobContext.Cron)
                },
                new ControlTableCell()
                {
                    Text = _ => jobContext.PluginContext?.PluginId?.ToString()
                },
                new ControlTableCell()
                {
                    Text = _ => jobContext.ApplicationContext?.ApplicationId
                }
            );

            return row;
        }

        /// <summary>
        /// Renders a schedule back into cron notation.
        /// </summary>
        /// <remarks>
        /// A cron object keeps its fields expanded into the set of matching values, so the
        /// original expression is no longer available. Collapsing the set back is lossless
        /// enough to read: a field covering its whole range is the wildcard again, and
        /// consecutive values become a range.
        /// </remarks>
        /// <param name="cron">The schedule, or null when the job carries none.</param>
        /// <returns>The cron expression.</returns>
        private static string Format(Cron cron)
        {
            if (cron is null)
            {
                return null;
            }

            return string.Join(' ',
            [
                Format(cron.Minute, 60),
                Format(cron.Hour, 24),
                Format(cron.Day, 31),
                Format(cron.Month, 12),
                Format(cron.Weekday, 7)
            ]);
        }

        /// <summary>
        /// Renders a single cron field back into its notation.
        /// </summary>
        /// <param name="values">The matching values of the field.</param>
        /// <param name="count">The number of values a wildcard expands to.</param>
        /// <returns>The field expression.</returns>
        private static string Format(IEnumerable<int> values, int count)
        {
            var sorted = values?.Distinct().OrderBy(x => x).ToList() ?? [];

            if (sorted.Count == 0)
            {
                return "?";
            }

            if (sorted.Count == count)
            {
                return "*";
            }

            var parts = new List<string>();

            for (var i = 0; i < sorted.Count;)
            {
                var last = i;
                while (last + 1 < sorted.Count && sorted[last + 1] == sorted[last] + 1)
                {
                    last++;
                }

                // a run of two is written out rather than hyphenated, which would be no shorter
                parts.Add(last - i > 1 ? $"{sorted[i]}-{sorted[last]}" : string.Join(',', sorted.GetRange(i, last - i + 1)));
                i = last + 1;
            }

            return string.Join(',', parts);
        }
    }
}
