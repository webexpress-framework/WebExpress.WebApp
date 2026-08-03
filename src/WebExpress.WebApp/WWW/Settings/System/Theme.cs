using System.Collections.Generic;
using System.Linq;
using WebExpress.WebApp.WebScope;
using WebExpress.WebApp.WebSettingPage;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebComponent;
using WebExpress.WebCore.WebIcon;
using WebExpress.WebCore.WebPage;
using WebExpress.WebCore.WebSettingPage;
using WebExpress.WebCore.WebTheme;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebIcon;

namespace WebExpress.WebApp.WWW.Settings.System
{
    /// <summary>
    /// Settings page listing the themes registered for the applications of the server.
    /// </summary>
    /// <remarks>
    /// A theme is chosen by the application rather than by the operator, so the page reports
    /// rather than configures: which themes an application brings, which of them is in effect,
    /// and what each one changes - the colour scheme, the icon set, the stylesheet.
    /// </remarks>
    [WebIcon<IconPalette>]
    [Title("webexpress.webapp:setting.title.theme.label")]
    [SettingGroup<SettingGroupSystemGeneral>()]
    [SettingSection(SettingSection.Secondary)]
    [Scope<IScopeAdmin>]
    public sealed class Theme : ISettingPage<VisualTreeWebAppSetting>, IScopeAdmin
    {
        private readonly IComponentHub _componentHub;

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="componentHub">The component hub.</param>
        public Theme(IComponentHub componentHub)
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

            // the registration order decides which theme wins when an application declares no
            // default, so the enumeration is kept as it comes and only a copy is sorted
            var registered = _componentHub?.ThemeManager.Themes.ToList() ?? [];

            panel.AddPrimary(new ControlText()
            {
                Text = _ => I18N.Translate(renderContext, "webexpress.webapp:setting.theme.description"),
                Margin = _ => new PropertySpacingMargin(PropertySpacing.Space.Two)
            });

            if (registered.Count == 0)
            {
                panel.AddPrimary(new ControlEmptyState()
                {
                    Icon = _ => new IconPalette(),
                    Title = _ => I18N.Translate(renderContext, "webexpress.webapp:setting.theme.empty.title"),
                    Message = _ => I18N.Translate(renderContext, "webexpress.webapp:setting.theme.empty.message")
                });

                return;
            }

            var table = new ControlTable() { Striped = _ => TypeStripedTable.Row };
            table.AddColumn(I18N.Translate(renderContext, "webexpress.webapp:setting.theme.name.label"));
            table.AddColumn(I18N.Translate(renderContext, "webexpress.webapp:setting.theme.mode.label"));
            table.AddColumn(I18N.Translate(renderContext, "webexpress.webapp:setting.theme.icon.label"));
            table.AddColumn(I18N.Translate(renderContext, "webexpress.webapp:setting.theme.application.label"));
            table.AddColumn(I18N.Translate(renderContext, "webexpress.webapp:setting.theme.state.label"));

            table.AddRows(registered
                .OrderBy(x => x.ApplicationContext?.ApplicationId)
                .ThenBy(x => x.ThemeId?.ToString())
                .Select(x => CreateRow(renderContext, registered, x)));

            panel.AddPrimary(table);
        }

        /// <summary>
        /// Creates the table row of a single theme.
        /// </summary>
        /// <param name="renderContext">The render context.</param>
        /// <param name="registered">The themes in registration order.</param>
        /// <param name="themeContext">The theme.</param>
        /// <returns>The row.</returns>
        private ControlTableRow CreateRow(IRenderContext renderContext, IEnumerable<IThemeContext> registered, IThemeContext themeContext)
        {
            var image = SettingIcon.Resolve(_componentHub, themeContext.PluginContext, themeContext.Image);
            var id = themeContext.ThemeId?.ToString();
            var name = I18N.Translate(renderContext, themeContext.Name);
            var description = I18N.Translate(renderContext, themeContext.Description);

            var row = new ControlTableRow()
            {
                Icon = _ => image is not null ? new ImageIcon(image) : (IIcon)new IconPalette()
            };

            row.Add
            (
                new ControlTableCellPanel() { Class = _ => "wx-table-cell-stack" }.Add
                (
                    new ControlText()
                    {
                        Text = _ => !string.IsNullOrWhiteSpace(name) ? name : id,
                        Format = _ => TypeFormatText.Bold,
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
                new ControlTableCellPanel().Add(new ControlBadge()
                {
                    Value = _ => I18N.Translate(renderContext, themeContext.ThemeMode == ThemeMode.Dark
                        ? "webexpress.webapp:setting.theme.mode.dark"
                        : "webexpress.webapp:setting.theme.mode.light"),
                    BackgroundColor = _ => new PropertyColorBackgroundBadge(themeContext.ThemeMode == ThemeMode.Dark
                        ? TypeColorBackgroundBadge.Dark
                        : TypeColorBackgroundBadge.Light),
                    Pill = _ => TypePillBadge.Pill
                }),
                new ControlTableCellPanel().Add(new ControlBadge()
                {
                    Value = _ => I18N.Translate(renderContext, themeContext.IconTheme == TypeIconTheme.Light
                        ? "webexpress.webapp:setting.theme.icon.light"
                        : "webexpress.webapp:setting.theme.icon.default"),
                    BackgroundColor = _ => new PropertyColorBackgroundBadge(TypeColorBackgroundBadge.Secondary),
                    Pill = _ => TypePillBadge.Pill
                }),
                new ControlTableCell()
                {
                    Text = _ => themeContext.ApplicationContext?.ApplicationId
                },
                new ControlTableCellPanel().Add(CreateStateBadges(renderContext, registered, themeContext))
            );

            return row;
        }

        /// <summary>
        /// Creates the chips that state how a theme takes effect.
        /// </summary>
        /// <remarks>
        /// The effective theme is resolved the way the framework resolves it at render time
        /// (see <see cref="RenderContextThemeExtensions.GetActiveTheme"/>): the declared default
        /// wins, otherwise the first theme registered for the application. Both cases are told
        /// apart, because a theme that is merely first in line changes as soon as another one
        /// registers, while a declared default does not.
        /// </remarks>
        /// <param name="renderContext">The render context.</param>
        /// <param name="registered">The themes in registration order.</param>
        /// <param name="themeContext">The theme.</param>
        /// <returns>The chips.</returns>
        private static IEnumerable<IControl> CreateStateBadges(IRenderContext renderContext, IEnumerable<IThemeContext> registered, IThemeContext themeContext)
        {
            var application = themeContext.ApplicationContext;
            var declared = application?.DefaultTheme;

            if (declared is not null && declared.ThemeId?.ToString() == themeContext.ThemeId?.ToString())
            {
                yield return CreateBadge(renderContext, "webexpress.webapp:setting.theme.state.default", TypeColorBackgroundBadge.Success);
            }
            else if (declared is null && registered.FirstOrDefault(x => x.ApplicationContext == application) == themeContext)
            {
                yield return CreateBadge(renderContext, "webexpress.webapp:setting.theme.state.fallback", TypeColorBackgroundBadge.Info);
            }

            if (themeContext.ThemeStyle is not null)
            {
                yield return CreateBadge(renderContext, "webexpress.webapp:setting.theme.state.stylesheet", TypeColorBackgroundBadge.Secondary);
            }
        }

        /// <summary>
        /// Creates a single state chip.
        /// </summary>
        /// <param name="renderContext">The render context.</param>
        /// <param name="key">The internationalization key of the label.</param>
        /// <param name="color">The chip color.</param>
        /// <returns>The chip.</returns>
        private static ControlBadge CreateBadge(IRenderContext renderContext, string key, TypeColorBackgroundBadge color)
        {
            return new ControlBadge()
            {
                Value = _ => I18N.Translate(renderContext, key),
                BackgroundColor = _ => new PropertyColorBackgroundBadge(color),
                Pill = _ => TypePillBadge.Pill
            };
        }
    }
}
