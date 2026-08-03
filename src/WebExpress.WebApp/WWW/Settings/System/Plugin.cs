using System;
using System.Collections.Generic;
using System.Linq;
using WebExpress.WebApp.WebApiControl;
using WebExpress.WebApp.WebScope;
using WebExpress.WebApp.WebSettingPage;
using WebExpress.WebApp.WWW.Api.V1;
using WebExpress.WebCore;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebComponent;
using WebExpress.WebCore.WebIcon;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebPackage.Model;
using WebExpress.WebCore.WebPage;
using WebExpress.WebCore.WebPlugin;
using WebExpress.WebCore.WebSettingPage;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebIcon;

namespace WebExpress.WebApp.WWW.Settings.System
{
    /// <summary>
    /// Settings page for plugin package management.
    /// </summary>
    [WebIcon<IconPuzzlePiece>]
    [Title("webexpress.webapp:setting.title.plugin.label")]
    [SettingGroup<SettingGroupSystemGeneral>()]
    [SettingSection(SettingSection.Secondary)]
    [Scope<IScopeAdmin>]
    public sealed class Plugin : ISettingPage<VisualTreeWebAppSetting>, IScopeAdmin
    {
        private readonly IComponentHub _componentHub;

        /// <summary>
        /// Gets the label control.
        /// </summary>
        private ControlText Label { get; } = new ControlText()
        {
            Text = _ => "webexpress.webapp:setting.plugin.label",
            Margin = _ => new PropertySpacingMargin(PropertySpacing.Space.Two),
            TextColor = _ => new PropertyColorText(TypeColorText.Info)
        };

        /// <summary>
        /// Gets the help text control.
        /// </summary>
        private ControlText Description { get; } = new ControlText()
        {
            Text = _ => "webexpress.webapp:setting.plugin.description",
            Margin = _ => new PropertySpacingMargin(PropertySpacing.Space.Two)
        };

        /// <summary>
        /// Gets the upload button for installing plugin packages.
        /// </summary>
        private ControlButton UploadButton { get; } = new ControlButton()
        {
            Text = _ => "webexpress.webapp:setting.plugin.upload.label",
            Margin = _ => new PropertySpacingMargin(PropertySpacing.Space.Two),
            BackgroundColor = _ => new PropertyColorButton(TypeColorButton.Primary),
            Icon = _ => new IconUpload(),
            Active = _ => TypeActive.Active
        };

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="componentHub">The component hub.</param>
        public Plugin(IComponentHub componentHub)
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
            var applicationContext = renderContext?.PageContext?.ApplicationContext;
            var packageApiUri = WebEx.ComponentHub.SitemapManager.GetUri<PluginPackage>(applicationContext);

            UploadButton.PrimaryAction = _ => new ActionPluginPackage(packageApiUri, RequestMethod.POST.ToString(), true);

            visualTree.Content.MainPanel.Headline.AddSecondary(UploadButton);
            visualTree.Content.MainPanel.AddPrimary(Description);
            visualTree.Content.MainPanel.AddPrimary(Label);

            // GetPackages, not Catalog.Packages: the catalog only knows what was installed from a
            // *.wxp file, while a build deployment references every plugin statically
            var packages = _componentHub?.PackageManager.GetPackages().OrderBy(x => x.Id).ToList() ?? [];

            if (packages.Count == 0)
            {
                visualTree.Content.MainPanel.AddPrimary(new ControlEmptyState()
                {
                    Icon = _ => new IconPuzzlePiece(),
                    Title = _ => I18N.Translate(renderContext, "webexpress.webapp:setting.plugin.empty.title"),
                    Message = _ => I18N.Translate(renderContext, "webexpress.webapp:setting.plugin.empty.message")
                });

                return;
            }

            var packageTable = new ControlTable() { Striped = _ => TypeStripedTable.Row };
            packageTable.AddColumn(I18N.Translate(renderContext, "webexpress.webapp:setting.plugin.name.label"));
            packageTable.AddColumn(I18N.Translate(renderContext, "webexpress.webapp:setting.plugin.version.label"));
            packageTable.AddColumn(I18N.Translate(renderContext, "webexpress.webapp:setting.plugin.state.label"));

            packageTable.AddRows(packages.Select(x => CreateRow(renderContext, _componentHub, x, packageApiUri)));

            visualTree.Content.MainPanel.AddPrimary(packageTable);
        }

        /// <summary>
        /// Creates the table row of a single package.
        /// </summary>
        /// <param name="renderContext">The render context.</param>
        /// <param name="componentHub">The component hub.</param>
        /// <param name="package">The package.</param>
        /// <param name="apiUri">The API base uri.</param>
        /// <returns>The row.</returns>
        private static ControlTableRow CreateRow(IRenderContext renderContext, IComponentHub componentHub, PackageCatalogItem package, IUri apiUri)
        {
            var pluginContext = package.Plugins.FirstOrDefault();
            var pluginIcon = SettingIcon.Resolve(componentHub, pluginContext, pluginContext?.Icon);
            var packageName = pluginContext?.PluginName ?? package.Id;
            var packageVersion = package.Metadata?.Version ?? pluginContext?.Version ?? "-";

            var row = new ControlTableRow()
            {
                // a plugin is free to ship without an icon, so the generic puzzle piece stands
                // in for it - an empty slot would read as a rendering fault rather than a choice
                Icon = _ => pluginIcon is not null ? new ImageIcon(pluginIcon) : (IIcon)new IconPuzzlePiece()
            };

            row.Add
            (
                new ControlTableCellPanel() { Class = _ => "wx-table-cell-stack" }.Add
                (
                    new ControlText()
                    {
                        Text = _ => I18N.Translate(renderContext, packageName),
                        Format = _ => TypeFormatText.Bold
                    },
                    new ControlText()
                    {
                        Text = _ => CreateSubtitle(renderContext, package),
                        Format = _ => TypeFormatText.Default,
                        TextColor = _ => new PropertyColorText(TypeColorText.Secondary),
                        Size = _ => new PropertySizeText(TypeSizeText.Small)
                    }
                ),
                new ControlTableCell()
                {
                    Text = _ => packageVersion
                },
                new ControlTableCellPanel().Add(CreateStateBadges(renderContext, package))
            );

            // a plugin in the application directory cannot be deactivated, replaced or removed
            // while the process runs, so it carries no menu at all rather than a dead one; the
            // subtitle of the row states why
            if (!package.BuiltIn)
            {
                row.Add(CreateActions(renderContext, package, apiUri));
            }

            return row;
        }

        /// <summary>
        /// Creates the secondary line of the name cell, which collects the descriptive
        /// metadata that does not warrant a column of its own.
        /// </summary>
        /// <param name="renderContext">The render context.</param>
        /// <param name="package">The package.</param>
        /// <returns>The subtitle text.</returns>
        private static string CreateSubtitle(IRenderContext renderContext, PackageCatalogItem package)
        {
            // a plugin may declare a description key that resolves to nothing, so the parts
            // are filtered after translation rather than before - otherwise the join leaves a
            // separator in front of the first visible part
            var parts = new List<string>
            {
                I18N.Translate(renderContext, package.Metadata?.Description),
                !string.IsNullOrWhiteSpace(package.Metadata?.Authors) ? string.Format
                (
                    I18N.Translate(renderContext, "webexpress.webapp:setting.plugin.package.author.label"),
                    package.Metadata.Authors
                ) : null,
                package.BuiltIn
                    ? I18N.Translate(renderContext, "webexpress.webapp:setting.plugin.builtin.hint")
                    : string.Format
                    (
                        I18N.Translate(renderContext, "webexpress.webapp:setting.plugin.package.file.label"),
                        package.File
                    )
            };

            return string.Join(" · ", parts.Where(x => !string.IsNullOrWhiteSpace(x)));
        }

        /// <summary>
        /// Creates the state chips of a package.
        /// </summary>
        /// <param name="renderContext">The render context.</param>
        /// <param name="package">The package.</param>
        /// <returns>The chips.</returns>
        private static IEnumerable<IControl> CreateStateBadges(IRenderContext renderContext, PackageCatalogItem package)
        {
            var (label, color) = package.State switch
            {
                PackageCatalogeItemState.Active => ("webexpress.webapp:setting.plugin.state.active", TypeColorBackgroundBadge.Success),
                PackageCatalogeItemState.Disable => ("webexpress.webapp:setting.plugin.state.disabled", TypeColorBackgroundBadge.Secondary),
                _ => ("webexpress.webapp:setting.plugin.state.available", TypeColorBackgroundBadge.Info)
            };

            yield return new ControlBadge()
            {
                Value = _ => I18N.Translate(renderContext, label),
                BackgroundColor = _ => new PropertyColorBackgroundBadge(color),
                Pill = _ => TypePillBadge.Pill
            };

            if (package.BuiltIn)
            {
                yield return new ControlBadge()
                {
                    Value = _ => I18N.Translate(renderContext, "webexpress.webapp:setting.plugin.builtin.label"),
                    BackgroundColor = _ => new PropertyColorBackgroundBadge(TypeColorBackgroundBadge.Light),
                    Pill = _ => TypePillBadge.Pill
                };
            }
        }

        /// <summary>
        /// Creates the menu entries of a package.
        /// </summary>
        /// <param name="renderContext">The render context.</param>
        /// <param name="package">The package.</param>
        /// <param name="apiUri">The API base uri.</param>
        /// <returns>The menu entries.</returns>
        private static IEnumerable<IControlDropdownItem> CreateActions(IRenderContext renderContext, PackageCatalogItem package, IUri apiUri)
        {
            var packageIdEscaped = Uri.EscapeDataString(package.Id ?? string.Empty);
            var isActive = package.State == PackageCatalogeItemState.Active;

            yield return new ControlDropdownItemLink()
            {
                Text = _ => isActive
                    ? "webexpress.webapp:setting.plugin.action.deactivate.label"
                    : "webexpress.webapp:setting.plugin.action.activate.label",
                Icon = _ => isActive ? new IconPowerOff() : new IconPlay(),
                PrimaryAction = _ => new ActionPluginPackage
                (
                    new UriEndpoint(BuildUri(apiUri, $"action/{(isActive ? "deactivate" : "activate")}/{packageIdEscaped}")),
                    RequestMethod.PUT.ToString()
                )
                {
                    ConfirmText = I18N.Translate
                    (
                        renderContext,
                        isActive
                            ? "webexpress.webapp:setting.plugin.action.deactivate.confirm"
                            : "webexpress.webapp:setting.plugin.action.activate.confirm",
                        package.Id
                    )
                }
            };

            yield return new ControlDropdownItemLink()
            {
                Text = _ => "webexpress.webapp:setting.plugin.action.update.label",
                Icon = _ => new IconArrowsRotate(),
                PrimaryAction = _ => new ActionPluginPackage
                (
                    new UriEndpoint(BuildUri(apiUri, $"action/update/{packageIdEscaped}")),
                    RequestMethod.PUT.ToString(),
                    true
                )
                {
                    ConfirmText = I18N.Translate(renderContext, "webexpress.webapp:setting.plugin.action.update.confirm", package.Id)
                }
            };

            yield return new ControlDropdownItemDivider();

            yield return new ControlDropdownItemLink()
            {
                Text = _ => "webexpress.webapp:setting.plugin.action.delete.label",
                Icon = _ => new IconTrashAlt(),
                Color = _ => TypeColorText.Danger,
                PrimaryAction = _ => new ActionPluginPackage
                (
                    new UriEndpoint(BuildUri(apiUri, $"item/{packageIdEscaped}")),
                    RequestMethod.DELETE.ToString()
                )
                {
                    ConfirmText = I18N.Translate(renderContext, "webexpress.webapp:setting.plugin.action.delete.confirm", package.Id)
                }
            };
        }

        /// <summary>
        /// Builds a full uri from a base uri and relative segment.
        /// </summary>
        /// <param name="baseUri">The base uri.</param>
        /// <param name="relative">The relative path segment.</param>
        /// <returns>The combined uri.</returns>
        private static string BuildUri(IUri baseUri, string relative)
        {
            var baseString = baseUri?.ToString() ?? "/";
            return baseString.EndsWith("/", StringComparison.Ordinal) ? baseString + relative : baseString + "/" + relative;
        }
    }
}
