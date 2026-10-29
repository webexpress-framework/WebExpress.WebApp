using System;
using System.Collections.Generic;
using System.Linq;
using WebExpress.WebApp.WebApiControl;
using WebExpress.WebApp.WebScope;
using WebExpress.WebApp.WebSettingPage;
using WebExpress.WebApp.WWW.Api.V1;
using WebExpress.WebCore.WebPolicies;
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
    [Policy<SystemAccessPolicy>]
    public sealed class Plugin : ISettingPage<VisualTreeWebAppSetting>, IScopeAdmin
    {
        /// <summary>
        /// The token the update confirmation carries for the name of the chosen file; the file
        /// is only known in the browser once it was picked, so the client fills it in.
        /// </summary>
        internal const string FileToken = "{file}";

        /// <summary>
        /// The id of the search box, by which the table finds the box it is bound to.
        /// </summary>
        private const string SearchId = "wx-plugin-search";

        /// <summary>
        /// The id of the plugin table.
        /// </summary>
        private const string TableId = "wx-plugin-table";

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
            var packageApiUri = _componentHub?.SitemapManager.GetUri<PluginPackage>(applicationContext);

            UploadButton.PrimaryAction = _ => new ActionPluginPackage(packageApiUri, RequestMethod.POST.ToString(), true);

            visualTree.Content.MainPanel.Headline.AddSecondary(UploadButton);
            visualTree.Content.MainPanel.AddPrimary(Description);
            visualTree.Content.MainPanel.AddPrimary(Label);

            // GetPackages, not Catalog.Packages: the catalog only knows what was installed from a
            // *.wxp file, while a build deployment references every plugin statically
            var packageManager = _componentHub?.PackageManager;
            var packages = packageManager?.GetPackages().OrderBy(x => x.Id).ToList() ?? [];

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

            // the list is searched in the browser: it holds every package and plugin already,
            // so a term narrows it without a round trip
            var search = new ControlSearch(SearchId)
            {
                Placeholder = _ => I18N.Translate(renderContext, "webexpress.webapp:setting.plugin.search.placeholder"),
                Margin = _ => new PropertySpacingMargin(PropertySpacing.Space.Two)
            };

            var packageTable = new ControlTable(TableId)
            {
                Striped = _ => TypeStripedTable.Row,
                Bind = _ => new Binding().Add(new BindSearch() { Source = SearchId })
            };
            packageTable.AddColumn(I18N.Translate(renderContext, "webexpress.webapp:setting.plugin.name.label"));
            packageTable.AddColumn(I18N.Translate(renderContext, "webexpress.webapp:setting.plugin.version.label"));
            packageTable.AddColumn(I18N.Translate(renderContext, "webexpress.webapp:setting.plugin.state.label"));

            packageTable.AddRows(packages.Select(x => CreateRow
            (
                renderContext,
                _componentHub,
                x,
                packageManager.GetDependentPackages(x.Id).Select(d => d.Id).ToList(),
                PluginPackage.GetStoppedWith(packageManager, x).Select(d => d.Id).ToList(),
                PluginPackage.IsRequiredByManagement(packageManager, x, applicationContext),
                packageApiUri
            )));

            visualTree.Content.MainPanel.AddPrimary(search, packageTable);
        }

        /// <summary>
        /// Creates the table row of a single package.
        /// </summary>
        /// <param name="renderContext">The render context.</param>
        /// <param name="componentHub">The component hub.</param>
        /// <param name="package">The package.</param>
        /// <param name="dependents">The ids of the active packages that depend on the package.</param>
        /// <param name="stoppedWith">The ids of the packages a deactivation stops along.</param>
        /// <param name="required">True when the management runs on the package.</param>
        /// <param name="apiUri">The API base uri.</param>
        /// <returns>The row.</returns>
        private static ControlTableRow CreateRow(IRenderContext renderContext, IComponentHub componentHub, PackageCatalogItem package, IReadOnlyList<string> dependents, IReadOnlyList<string> stoppedWith, bool required, IUri apiUri)
        {
            var pluginContext = package.Plugins.FirstOrDefault();
            var pluginIcon = SettingIcon.Resolve(componentHub, pluginContext, pluginContext?.Icon);
            // a package that is not running has no plugin context; its own title keeps the row
            // from falling back to the bare id and changing its name with every state change
            var packageName = pluginContext?.PluginName
                ?? (!string.IsNullOrWhiteSpace(package.Metadata?.Title) ? package.Metadata.Title : package.Id);
            var packageVersion = package.Metadata?.Version ?? pluginContext?.Version ?? "-";

            var row = new ControlTableRow()
            {
                // a plugin is free to ship without an icon, so the generic puzzle piece stands
                // in for it - an empty slot would read as a rendering fault rather than a choice
                Icon = _ => pluginIcon is not null ? new ImageIcon(pluginIcon) : (IIcon)new IconPuzzlePiece()
            };

            var nameCell = new ControlTableCellPanel() { Class = _ => "wx-table-cell-stack" }.Add
            (
                new ControlText()
                {
                    Text = _ => I18N.Translate(renderContext, packageName),
                    Format = _ => TypeFormatText.Bold
                },
                CreateNote(CreateSubtitle(renderContext, package), TypeColorText.Secondary)
            );

            // the lines of the cell are ellipsized, so the relations get a line of their own
            // rather than trailing a description that pushes them out of sight
            var relations = CreateRelations(renderContext, package, dependents);
            if (!string.IsNullOrWhiteSpace(relations))
            {
                nameCell.Add(CreateNote(relations, TypeColorText.Secondary));
            }

            // it explains why the menu offers no deactivation
            if (required && !package.SystemPlugin)
            {
                nameCell.Add(CreateNote(I18N.Translate(renderContext, "webexpress.webapp:setting.plugin.package.required.label"), TypeColorText.Secondary));
            }

            // why a package does not run is what an administrator opens the page for; the state
            // chip alone cannot tell waiting for a dependency from a failed start
            var problem = package.GetProblem(renderContext?.Request?.Culture);
            if (!string.IsNullOrWhiteSpace(problem))
            {
                nameCell.Add(CreateNote(problem, TypeColorText.Warning));
            }

            row.Add
            (
                nameCell,
                new ControlTableCell()
                {
                    Text = _ => packageVersion
                },
                new ControlTableCellPanel().Add(CreateStateBadges(renderContext, package))
            );

            // a row without a single possible action carries no menu at all rather than an
            // empty one; the row states why
            var actions = CreateActions(renderContext, package, dependents, stoppedWith, required, apiUri).ToList();
            if (actions.Count > 0)
            {
                row.Add(actions);
            }

            return row;
        }

        /// <summary>
        /// Creates a small secondary line of the name cell.
        /// </summary>
        /// <param name="text">The text of the line.</param>
        /// <param name="color">The text color.</param>
        /// <returns>The line.</returns>
        private static ControlText CreateNote(string text, TypeColorText color)
        {
            return new ControlText()
            {
                Text = _ => text,
                Format = _ => TypeFormatText.Default,
                TextColor = _ => new PropertyColorText(color),
                Size = _ => new PropertySizeText(TypeSizeText.Small)
            };
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
                package.SystemPlugin
                    ? I18N.Translate(renderContext, "webexpress.webapp:setting.plugin.system.hint")
                    : package.BuiltIn
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
        /// Creates the line naming the packages a package needs and the packages that need it.
        /// </summary>
        /// <param name="renderContext">The render context.</param>
        /// <param name="package">The package.</param>
        /// <param name="dependents">The ids of the active packages that depend on the package.</param>
        /// <returns>The text, or an empty text when the package stands alone.</returns>
        private static string CreateRelations(IRenderContext renderContext, PackageCatalogItem package, IReadOnlyList<string> dependents)
        {
            var dependencies = package.Metadata?.Dependencies?.Where(x => !string.IsNullOrWhiteSpace(x)).ToList() ?? [];

            var parts = new List<string>
            {
                dependencies.Count > 0 ? string.Format
                (
                    I18N.Translate(renderContext, "webexpress.webapp:setting.plugin.package.dependencies.label"),
                    string.Join(", ", dependencies)
                ) : null,
                // it explains why the menu offers neither deactivating nor deleting
                dependents.Count > 0 ? string.Format
                (
                    I18N.Translate(renderContext, "webexpress.webapp:setting.plugin.package.dependents.label"),
                    string.Join(", ", dependents)
                ) : null
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
                PackageCatalogItemState.Active => ("webexpress.webapp:setting.plugin.state.active", TypeColorBackgroundBadge.Success),
                PackageCatalogItemState.Disable => ("webexpress.webapp:setting.plugin.state.disabled", TypeColorBackgroundBadge.Secondary),
                _ => ("webexpress.webapp:setting.plugin.state.available", TypeColorBackgroundBadge.Warning)
            };

            yield return new ControlBadge()
            {
                Value = _ => I18N.Translate(renderContext, label),
                BackgroundColor = _ => new PropertyColorBackgroundBadge(color),
                Pill = _ => TypePillBadge.Pill
            };

            if (package.BuiltIn)
            {
                var builtInLabel = package.SystemPlugin
                    ? "webexpress.webapp:setting.plugin.system.label"
                    : "webexpress.webapp:setting.plugin.builtin.label";

                yield return new ControlBadge()
                {
                    Value = _ => I18N.Translate(renderContext, builtInLabel),
                    BackgroundColor = _ => new PropertyColorBackgroundBadge(TypeColorBackgroundBadge.Light),
                    Pill = _ => TypePillBadge.Pill
                };
            }
        }

        /// <summary>
        /// Creates the menu entries of a package.
        /// </summary>
        /// <remarks>
        /// A system plugin offers nothing, and the package the management itself runs on can be
        /// neither deactivated nor deleted - the server refuses these, and an entry that can only
        /// fail is a dead one. A package other active packages run on can be deactivated, which
        /// stops them along and is said so in the question, but not deleted. A built-in plugin
        /// has no update, since there is no package file to replace it with.
        /// </remarks>
        /// <param name="renderContext">The render context.</param>
        /// <param name="package">The package.</param>
        /// <param name="dependents">The ids of the active packages that depend on the package.</param>
        /// <param name="stoppedWith">The ids of the packages a deactivation stops along.</param>
        /// <param name="required">True when the management runs on the package.</param>
        /// <param name="apiUri">The API base uri.</param>
        /// <returns>The menu entries.</returns>
        private static IEnumerable<IControlDropdownItem> CreateActions(IRenderContext renderContext, PackageCatalogItem package, IReadOnlyList<string> dependents, IReadOnlyList<string> stoppedWith, bool required, IUri apiUri)
        {
            if (package.SystemPlugin)
            {
                yield break;
            }

            var packageIdEscaped = Uri.EscapeDataString(package.Id ?? string.Empty);
            var isActive = package.State == PackageCatalogItemState.Active;
            var removable = dependents.Count == 0;
            var settings = package.Metadata?.Settings?.ToList() ?? [];

            if (!isActive || !required)
            {
                var confirm = !isActive
                    ? I18N.Translate(renderContext, "webexpress.webapp:setting.plugin.action.activate.confirm", package.Id)
                    : stoppedWith.Count > 0
                    ? I18N.Translate(renderContext, "webexpress.webapp:setting.plugin.action.deactivate.dependents.confirm", package.Id, string.Join(", ", stoppedWith))
                    : I18N.Translate(renderContext, "webexpress.webapp:setting.plugin.action.deactivate.confirm", package.Id);

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
                        ConfirmText = confirm
                    }
                };
            }

            // a built-in plugin has no package file to replace it with
            if (!package.BuiltIn)
            {
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
                        ConfirmText = I18N.Translate(renderContext, "webexpress.webapp:setting.plugin.action.update.confirm", package.Id, FileToken)
                    }
                };
            }

            if (!removable || required)
            {
                yield break;
            }

            yield return new ControlDropdownItemDivider();

            // the file of a built-in plugin is locked while the process runs, which the question
            // has to say: the plugin stops at once, but its file goes only with the next start
            var deleteConfirm = package.BuiltIn
                ? "webexpress.webapp:setting.plugin.action.delete.builtin.confirm"
                : "webexpress.webapp:setting.plugin.action.delete.confirm";

            yield return new ControlDropdownItemLink()
            {
                Text = _ => "webexpress.webapp:setting.plugin.action.delete.label",
                Icon = _ => new IconTrash(),
                Color = _ => TypeColorText.Danger,
                PrimaryAction = _ => new ActionPluginPackage
                (
                    new UriEndpoint(BuildUri(apiUri, $"item/{packageIdEscaped}")),
                    RequestMethod.DELETE.ToString()
                )
                {
                    ConfirmText = I18N.Translate(renderContext, deleteConfirm, package.Id)
                }
            };

            // deployed settings files stay on a plain delete - they are the administrator's by
            // then - so removing them is a choice of its own, offered only when there are any
            if (settings.Count > 0)
            {
                yield return new ControlDropdownItemLink()
                {
                    Text = _ => "webexpress.webapp:setting.plugin.action.delete.settings.label",
                    Icon = _ => new IconTrash(),
                    Color = _ => TypeColorText.Danger,
                    PrimaryAction = _ => new ActionPluginPackage
                    (
                        new UriEndpoint(BuildUri(apiUri, $"item/{packageIdEscaped}?{PluginPackage.RemoveSettingsParameter}=true")),
                        RequestMethod.DELETE.ToString()
                    )
                    {
                        ConfirmText = I18N.Translate
                        (
                            renderContext,
                            "webexpress.webapp:setting.plugin.action.delete.settings.confirm",
                            package.Id,
                            string.Join(", ", settings)
                        )
                    }
                };
            }
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
