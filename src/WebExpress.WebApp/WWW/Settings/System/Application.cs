using System.Collections.Generic;
using System.Linq;
using WebExpress.WebApp.WebScope;
using WebExpress.WebApp.WebSettingPage;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebApplication;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebComponent;
using WebExpress.WebCore.WebIcon;
using WebExpress.WebCore.WebPage;
using WebExpress.WebCore.WebSettingPage;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebIcon;

namespace WebExpress.WebApp.WWW.Settings.System
{
    /// <summary>
    /// Settings page listing the applications hosted by the server.
    /// </summary>
    /// <remarks>
    /// The plugin page answers what is installed, this one answers what is reachable: a plugin
    /// contributes its pages to every application it is registered for, so the route an
    /// application is mounted under is what decides which url actually serves them.
    /// </remarks>
    [WebIcon<IconLayerGroup>]
    [Title("webexpress.webapp:setting.title.application.label")]
    [SettingGroup<SettingGroupSystemGeneral>()]
    [SettingSection(SettingSection.Secondary)]
    [Scope<IScopeAdmin>]
    public sealed class Application : ISettingPage<VisualTreeWebAppSetting>, IScopeAdmin
    {
        private readonly IComponentHub _componentHub;

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="componentHub">The component hub.</param>
        public Application(IComponentHub componentHub)
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
            var applications = _componentHub?.ApplicationManager.Applications
                .OrderBy(x => x.ApplicationId)
                .ToList() ?? [];

            panel.AddPrimary(new ControlText()
            {
                Text = _ => I18N.Translate(renderContext, "webexpress.webapp:setting.application.description"),
                Margin = _ => new PropertySpacingMargin(PropertySpacing.Space.Two)
            });

            if (applications.Count == 0)
            {
                panel.AddPrimary(new ControlEmptyState()
                {
                    Icon = _ => new IconLayerGroup(),
                    Title = _ => I18N.Translate(renderContext, "webexpress.webapp:setting.application.empty.title"),
                    Message = _ => I18N.Translate(renderContext, "webexpress.webapp:setting.application.empty.message")
                });

                return;
            }

            var table = new ControlTable() { Striped = _ => TypeStripedTable.Row };
            table.AddColumn(I18N.Translate(renderContext, "webexpress.webapp:setting.application.name.label"));
            table.AddColumn(I18N.Translate(renderContext, "webexpress.webapp:setting.application.route.label"));
            table.AddColumn(I18N.Translate(renderContext, "webexpress.webapp:setting.application.plugin.label"));
            table.AddColumn(I18N.Translate(renderContext, "webexpress.webapp:setting.application.theme.label"));

            table.AddRows(applications.Select(x => CreateRow(renderContext, x)));

            panel.AddPrimary(table);
        }

        /// <summary>
        /// Creates the table row of a single application.
        /// </summary>
        /// <param name="renderContext">The render context.</param>
        /// <param name="applicationContext">The application.</param>
        /// <returns>The row.</returns>
        private ControlTableRow CreateRow(IRenderContext renderContext, IApplicationContext applicationContext)
        {
            var icon = SettingIcon.Resolve(_componentHub, applicationContext.PluginContext, applicationContext.Icon);
            var route = applicationContext.Route?.ToUri();

            var row = new ControlTableRow()
            {
                // an application is free to ship without an icon, so the generic stack stands in
                // for it - an empty slot would read as a rendering fault rather than a choice
                Icon = _ => icon is not null ? new ImageIcon(icon) : (IIcon)new IconLayerGroup()
            };

            row.Add
            (
                new ControlTableCellPanel() { Class = _ => "wx-table-cell-stack" }.Add
                (
                    new ControlText()
                    {
                        Text = _ => I18N.Translate(renderContext, applicationContext.ApplicationName ?? applicationContext.ApplicationId),
                        Format = _ => TypeFormatText.Bold
                    },
                    new ControlText()
                    {
                        Text = _ => I18N.Translate(renderContext, applicationContext.Description),
                        Format = _ => TypeFormatText.Default,
                        TextColor = _ => new PropertyColorText(TypeColorText.Secondary),
                        Size = _ => new PropertySizeText(TypeSizeText.Small)
                    }
                ),
                // the route is a link rather than a value: reaching the application is the one
                // thing an operator wants to do from this row
                new ControlTableCell()
                {
                    Text = _ => route?.ToString(),
                    Uri = _ => route
                },
                new ControlTableCell()
                {
                    Text = _ => applicationContext.PluginContext?.PluginId?.ToString()
                },
                new ControlTableCellPanel().Add(CreateThemeBadge(renderContext, applicationContext))
            );

            return row;
        }

        /// <summary>
        /// Creates the chip naming the default theme of an application.
        /// </summary>
        /// <param name="renderContext">The render context.</param>
        /// <param name="applicationContext">The application.</param>
        /// <returns>The chip.</returns>
        private static IEnumerable<IControl> CreateThemeBadge(IRenderContext renderContext, IApplicationContext applicationContext)
        {
            var theme = applicationContext.DefaultTheme;

            yield return new ControlBadge()
            {
                Value = _ => theme is not null
                    ? I18N.Translate(renderContext, theme.Name ?? theme.ThemeId?.ToString())
                    : I18N.Translate(renderContext, "webexpress.webapp:setting.application.theme.none"),
                BackgroundColor = _ => new PropertyColorBackgroundBadge(theme is not null
                    ? TypeColorBackgroundBadge.Info
                    : TypeColorBackgroundBadge.Light),
                Pill = _ => TypePillBadge.Pill
            };
        }
    }
}
