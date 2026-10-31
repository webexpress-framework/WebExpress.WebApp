using System.Collections.Generic;
using System.Linq;
using WebExpress.WebApp.WebScope;
using WebExpress.WebApp.WebSettingPage;
using WebExpress.WebApp.WebTheme;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebComponent;
using WebExpress.WebCore.WebIcon;
using WebExpress.WebCore.WebPage;
using WebExpress.WebCore.WebPolicies;
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
    /// Applications can provide a preference selector while the shared catalog describes
    /// the registered color schemes and stylesheets. Persistence remains application-owned.
    /// </remarks>
    [WebIcon<IconPalette>]
    [Title("webexpress.webapp:setting.title.theme.label")]
    [SettingGroup<SettingGroupSystemGeneral>()]
    [SettingSection(SettingSection.Secondary)]
    [Scope<IScopeAdmin>]
    [Policy<SystemAccessPolicy>]
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
            var preference = ThemePreferences.Resolve(renderContext);
            visualTree.UseTheme(preference);
            var panel = visualTree.Content.MainPanel;

            // the registration order decides which theme wins when an application declares no
            // default, so the enumeration is kept as it comes and only a copy is sorted
            var registered = _componentHub?.ThemeManager.Themes.ToList() ?? [];
            var active = preference ?? renderContext.GetActiveTheme();

            panel.AddPrimary(CreateSelection(renderContext, active));
            panel.AddPrimary(CreateSectionTitle(renderContext, "webexpress.webapp:setting.theme.catalog.label"));
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
            table.AddColumn(I18N.Translate(renderContext, "webexpress.webapp:setting.theme.application.label"));
            table.AddColumn(I18N.Translate(renderContext, "webexpress.webapp:setting.theme.state.label"));

            table.AddRows(registered
                .OrderBy(x => x.ApplicationContext?.ApplicationId)
                .ThenBy(x => x.ThemeId?.ToString())
                .Select(x => CreateRow(renderContext, registered, active, x)));

            panel.AddPrimary(table);
        }

        /// <summary>
        /// Creates the section in which the visitor picks the appearance of the current application.
        /// </summary>
        /// <remarks>
        /// Theme, light or dark scheme and icons are separate decisions, each a bare dropdown
        /// whose caption is the value in use, so the section names what each one changes and
        /// that a choice takes effect at once without a save step. An application without any
        /// selector still gets the section, because the visitor would otherwise look for a
        /// choice that does not exist.
        /// </remarks>
        /// <param name="renderContext">The render context.</param>
        /// <param name="active">The theme the current page is rendered with.</param>
        /// <returns>The section.</returns>
        private static IControl CreateSelection(IRenderContext renderContext, IThemeContext active)
        {
            var application = renderContext.PageContext.ApplicationContext;
            var themeSelector = ThemePreferences.CreateSelector(application);
            var iconSetSelector = ThemePreferences.CreateIconSetSelector(application);
            var activeName = active is not null
                ? I18N.Translate(renderContext, active.Name) ?? active.ThemeId?.ToString()
                : I18N.Translate(renderContext, "webexpress.webapp:setting.application.theme.none");

            var section = new ControlPanel()
            {
                Margin = _ => new PropertySpacingMargin(PropertySpacing.Space.None, PropertySpacing.Space.None, PropertySpacing.Space.None, PropertySpacing.Space.Four)
            }
                .Add(CreateSectionTitle(renderContext, "webexpress.webapp:setting.theme.selection.label"));

            // the scheme sits next to the theme it overrides, the drawings come last
            var pickers = new (string Key, IControl Selector)[]
            {
                ("webexpress.webapp:setting.theme.selection.field", themeSelector),
                ("webexpress.webapp:setting.theme.mode.field", ThemePreferences.CreateColorSchemeSelector(application)),
                ("webexpress.webapp:setting.theme.iconset.field", iconSetSelector)
            }
                .Where(x => x.Selector is not null)
                .ToList();

            if (pickers.Count == 0)
            {
                return section.Add(new ControlText()
                {
                    Text = _ => I18N.Translate(renderContext, "webexpress.webapp:setting.theme.selection.unsupported", activeName),
                    Margin = _ => new PropertySpacingMargin(PropertySpacing.Space.Two)
                });
            }

            section.Add(new ControlText()
            {
                Text = _ => I18N.Translate(renderContext, "webexpress.webapp:setting.theme.selection.description"),
                Margin = _ => new PropertySpacingMargin(PropertySpacing.Space.Two)
            });

            // a grid keeps the captions in one column, so the pickers line up
            var choices = new ControlPanel()
            {
                Classes = ["wx-webapp-theme-choices", "m-2"]
            };

            foreach (var (key, selector) in pickers)
            {
                choices.Add(CreateChoiceLabel(renderContext, key), selector);
            }

            return section.Add(choices);
        }

        /// <summary>
        /// Creates the caption in front of a picker, whose own caption is the current value.
        /// </summary>
        /// <param name="renderContext">The render context.</param>
        /// <param name="key">The internationalization key of the caption.</param>
        /// <returns>The caption.</returns>
        private static ControlText CreateChoiceLabel(IRenderContext renderContext, string key)
        {
            return new ControlText()
            {
                Text = _ => I18N.Translate(renderContext, key),
                Format = _ => TypeFormatText.Bold
            };
        }

        /// <summary>
        /// Creates the caption that separates the personal choice from the catalog.
        /// </summary>
        /// <param name="renderContext">The render context.</param>
        /// <param name="key">The internationalization key of the caption.</param>
        /// <returns>The caption.</returns>
        private static ControlText CreateSectionTitle(IRenderContext renderContext, string key)
        {
            return new ControlText()
            {
                Text = _ => I18N.Translate(renderContext, key),
                Format = _ => TypeFormatText.H4,
                Margin = _ => new PropertySpacingMargin(PropertySpacing.Space.Two)
            };
        }

        /// <summary>
        /// Creates the table row of a single theme.
        /// </summary>
        /// <param name="renderContext">The render context.</param>
        /// <param name="registered">The themes in registration order.</param>
        /// <param name="active">The theme the current page is rendered with.</param>
        /// <param name="themeContext">The theme.</param>
        /// <returns>The row.</returns>
        private ControlTableRow CreateRow(IRenderContext renderContext, IEnumerable<IThemeContext> registered, IThemeContext active, IThemeContext themeContext)
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
                        // the line is ellipsized in a narrow column, so the full text stays reachable
                        Title = _ => description,
                        Format = _ => TypeFormatText.Default,
                        TextColor = _ => new PropertyColorText(TypeColorText.Secondary),
                        Size = _ => new PropertySizeText(TypeSizeText.Small)
                    }
                ),
                new ControlTableCell()
                {
                    Text = _ => themeContext.ApplicationContext?.ApplicationId
                },
                new ControlTableCellPanel().Add(CreateStateBadges(renderContext, registered, active, themeContext))
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
        /// registers, while a declared default does not. The active chip marks the theme this
        /// page is rendered with - the visitor's choice, or the default without one - so the
        /// catalog always answers which entry the selector above refers to.
        /// </remarks>
        /// <param name="renderContext">The render context.</param>
        /// <param name="registered">The themes in registration order.</param>
        /// <param name="active">The theme the current page is rendered with.</param>
        /// <param name="themeContext">The theme.</param>
        /// <returns>The chips.</returns>
        private static IEnumerable<IControl> CreateStateBadges(IRenderContext renderContext, IEnumerable<IThemeContext> registered, IThemeContext active, IThemeContext themeContext)
        {
            var application = themeContext.ApplicationContext;
            var declared = application?.DefaultTheme;
            // the declared default may be a context of its own, so the identity is compared
            if (active is not null && application == renderContext.PageContext.ApplicationContext
                && active.ThemeId?.ToString() == themeContext.ThemeId?.ToString())
            {
                yield return CreateBadge(renderContext, "webexpress.webapp:setting.theme.state.selected", TypeColorBackgroundBadge.Primary);
            }

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
