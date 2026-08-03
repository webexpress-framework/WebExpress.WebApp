using System.Collections.Generic;
using System.Linq;
using WebExpress.WebApp.WebScope;
using WebExpress.WebApp.WebSettingPage;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebComponent;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebPage;
using WebExpress.WebCore.WebRestApi;
using WebExpress.WebCore.WebSettingPage;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebIcon;

namespace WebExpress.WebApp.WWW.Settings.System
{
    /// <summary>
    /// Settings page listing the rest apis the server exposes.
    /// </summary>
    /// <remarks>
    /// The sitemap shows every endpoint as a path. This page answers the question an integrator
    /// actually has - which uri accepts which method in which version - which the path alone
    /// does not tell.
    /// </remarks>
    [WebIcon<IconPlug>]
    [Title("webexpress.webapp:setting.title.restapi.label")]
    [SettingGroup<SettingGroupSystemGeneral>()]
    [SettingSection(SettingSection.Secondary)]
    [Scope<IScopeAdmin>]
    public sealed class RestApi : ISettingPage<VisualTreeWebAppSetting>, IScopeAdmin
    {
        private readonly IComponentHub _componentHub;

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="componentHub">The component hub.</param>
        public RestApi(IComponentHub componentHub)
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
            var restApis = _componentHub?.RestApiManager.RestApis
                .OrderBy(x => x.Route?.ToString())
                .ToList() ?? [];

            panel.AddPrimary(new ControlText()
            {
                Text = _ => I18N.Translate(renderContext, "webexpress.webapp:setting.restapi.description"),
                Margin = _ => new PropertySpacingMargin(PropertySpacing.Space.Two)
            });

            if (restApis.Count == 0)
            {
                panel.AddPrimary(new ControlEmptyState()
                {
                    Icon = _ => new IconPlug(),
                    Title = _ => I18N.Translate(renderContext, "webexpress.webapp:setting.restapi.empty.title"),
                    Message = _ => I18N.Translate(renderContext, "webexpress.webapp:setting.restapi.empty.message")
                });

                return;
            }

            var table = new ControlTable() { Striped = _ => TypeStripedTable.Row };
            table.AddColumn(I18N.Translate(renderContext, "webexpress.webapp:setting.restapi.route.label"));
            table.AddColumn(I18N.Translate(renderContext, "webexpress.webapp:setting.restapi.method.label"));
            table.AddColumn(I18N.Translate(renderContext, "webexpress.webapp:setting.restapi.version.label"));
            table.AddColumn(I18N.Translate(renderContext, "webexpress.webapp:setting.restapi.application.label"));

            table.AddRows(restApis.Select(x => CreateRow(renderContext, x)));

            panel.AddPrimary(table);
        }

        /// <summary>
        /// Creates the table row of a single rest api.
        /// </summary>
        /// <param name="renderContext">The render context.</param>
        /// <param name="restApiContext">The rest api.</param>
        /// <returns>The row.</returns>
        private static ControlTableRow CreateRow(IRenderContext renderContext, IRestApiContext restApiContext)
        {
            var row = new ControlTableRow()
            {
                Icon = _ => new IconPlug()
            };

            row.Add
            (
                new ControlTableCellPanel() { Class = _ => "wx-table-cell-stack" }.Add
                (
                    new ControlText()
                    {
                        Text = _ => restApiContext.Route?.ToString(),
                        Format = _ => TypeFormatText.Bold
                    },
                    new ControlText()
                    {
                        Text = _ => restApiContext.PluginContext?.PluginId?.ToString(),
                        Format = _ => TypeFormatText.Default,
                        TextColor = _ => new PropertyColorText(TypeColorText.Secondary),
                        Size = _ => new PropertySizeText(TypeSizeText.Small)
                    }
                ),
                new ControlTableCellPanel().Add(CreateMethodBadges(restApiContext)),
                new ControlTableCell()
                {
                    Text = _ => $"v{restApiContext.Version}"
                },
                new ControlTableCell()
                {
                    Text = _ => restApiContext.ApplicationContext?.ApplicationId
                }
            );

            return row;
        }

        /// <summary>
        /// Creates one chip per accepted request method.
        /// </summary>
        /// <remarks>
        /// The methods are colored the way an api console colors them, so a reading method and a
        /// destructive one are told apart before the label is read.
        /// </remarks>
        /// <param name="restApiContext">The rest api.</param>
        /// <returns>The chips.</returns>
        private static IEnumerable<IControl> CreateMethodBadges(IRestApiContext restApiContext)
        {
            foreach (var method in restApiContext.Methods ?? [])
            {
                yield return new ControlBadge()
                {
                    Value = _ => method.ToString(),
                    BackgroundColor = _ => new PropertyColorBackgroundBadge(method switch
                    {
                        RequestMethod.GET => TypeColorBackgroundBadge.Success,
                        RequestMethod.POST => TypeColorBackgroundBadge.Primary,
                        RequestMethod.PUT or RequestMethod.PATCH => TypeColorBackgroundBadge.Warning,
                        RequestMethod.DELETE => TypeColorBackgroundBadge.Danger,
                        _ => TypeColorBackgroundBadge.Secondary
                    }),
                    Pill = _ => TypePillBadge.Pill
                };
            }
        }
    }
}
