using System;
using System.Linq;
using WebExpress.WebApp.WebApiControl;
using WebExpress.WebApp.WWW.Api.V1;
using WebExpress.WebApp.WebScope;
using WebExpress.WebApp.WebSettingPage;
using WebExpress.WebCore;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebComponent;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebPackage.Model;
using WebExpress.WebCore.WebPage;
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
            Text = "webexpress.webapp:setting.plugin.label",
            Margin = new PropertySpacingMargin(PropertySpacing.Space.Two),
            TextColor = new PropertyColorText(TypeColorText.Info)
        };

        /// <summary>
        /// Gets the help text control.
        /// </summary>
        private ControlText Description { get; } = new ControlText()
        {
            Text = "webexpress.webapp:setting.plugin.description",
            Margin = new PropertySpacingMargin(PropertySpacing.Space.Two)
        };

        /// <summary>
        /// Gets the upload button for installing plugin packages.
        /// </summary>
        private ControlButton UploadButton { get; } = new ControlButton()
        {
            Text = "webexpress.webapp:setting.plugin.upload.label",
            Margin = new PropertySpacingMargin(PropertySpacing.Space.Two),
            BackgroundColor = new PropertyColorButton(TypeColorButton.Primary),
            Icon = new IconUpload(),
            Active = TypeActive.Active
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

            UploadButton.PrimaryAction = new ActionPluginPackage(packageApiUri, RequestMethod.POST.ToString(), true);

            var packageTable = new ControlTable() { Striped = TypeStripedTable.Row };
            packageTable.AddColumn("");
            packageTable.AddColumn(I18N.Translate(renderContext, "webexpress.webapp:setting.plugin.name.label"));
            packageTable.AddColumn(I18N.Translate(renderContext, "webexpress.webapp:setting.plugin.version.label"));
            packageTable.AddColumn(I18N.Translate(renderContext, "webexpress.webapp:setting.plugin.state.label"));
            packageTable.AddColumn(I18N.Translate(renderContext, "webexpress.webapp:setting.plugin.actions.label"));

            foreach (var package in _componentHub.PackageManager.Catalog.Packages.Where(x => x is not null).OrderBy(x => x.Id))
            {
                var pluginContext = package.Plugins.FirstOrDefault();
                var packageName = pluginContext?.PluginName ?? package.Id;
                var packageVersion = package.Metadata?.Version ?? pluginContext?.Version ?? "-";
                var packageIdEscaped = Uri.EscapeDataString(package.Id ?? string.Empty);
                var packageState = package.State switch
                {
                    PackageCatalogeItemState.Active => "webexpress.webapp:setting.plugin.state.active",
                    PackageCatalogeItemState.Disable => "webexpress.webapp:setting.plugin.state.disabled",
                    _ => "webexpress.webapp:setting.plugin.state.available"
                };

                var actions = CreateActions(renderContext, package, packageApiUri, packageIdEscaped);

                packageTable.AddRow
                (
                    new ControlTableCellPanel().Add(new ControlImage()
                    {
                        Uri = pluginContext?.Icon?.ToUri() ?? null,
                        Width = 32
                    }),
                    new ControlTableCellPanel().Add
                    (
                        new ControlText()
                        {
                            Text = I18N.Translate(renderContext, packageName),
                            Format = TypeFormatText.Default
                        },
                        !string.IsNullOrWhiteSpace(package.Metadata?.Authors) ? new ControlText()
                        {
                            Text = string.Format
                            (
                                I18N.Translate(renderContext, "webexpress.webapp:setting.plugin.package.author.label"),
                                package.Metadata.Authors
                            ),
                            Format = TypeFormatText.Default,
                            TextColor = new PropertyColorText(TypeColorText.Secondary),
                            Margin = new PropertySpacingMargin(PropertySpacing.Space.Two, PropertySpacing.Space.Null),
                            Size = new PropertySizeText(TypeSizeText.Small)
                        } : null,
                        !string.IsNullOrWhiteSpace(package.Metadata?.Description) ? new ControlText()
                        {
                            Text = string.Format
                            (
                                I18N.Translate(renderContext, "webexpress.webapp:setting.plugin.description.label"),
                                I18N.Translate(renderContext, package.Metadata.Description)
                            ),
                            Format = TypeFormatText.Default,
                            TextColor = new PropertyColorText(TypeColorText.Secondary),
                            Margin = new PropertySpacingMargin(PropertySpacing.Space.Two, PropertySpacing.Space.Null),
                            Size = new PropertySizeText(TypeSizeText.Small)
                        } : null,
                        new ControlText()
                        {
                            Text = string.Format
                            (
                                I18N.Translate(renderContext, "webexpress.webapp:setting.plugin.package.file.label"),
                                package.File
                            ),
                            Format = TypeFormatText.Code,
                            TextColor = new PropertyColorText(TypeColorText.Secondary),
                            Margin = new PropertySpacingMargin(PropertySpacing.Space.Two, PropertySpacing.Space.Null),
                            Size = new PropertySizeText(TypeSizeText.Small)
                        }
                    ),
                    new ControlTableCellPanel().Add(new ControlText()
                    {
                        Text = packageVersion,
                        Format = TypeFormatText.Code
                    }),
                    new ControlTableCellPanel().Add(new ControlText()
                    {
                        Text = I18N.Translate(renderContext, packageState),
                        Format = TypeFormatText.Default
                    }),
                    actions
                );
            }

            visualTree.Content.MainPanel.Headline.AddSecondary(UploadButton);
            visualTree.Content.MainPanel.AddPrimary(Description);
            visualTree.Content.MainPanel.AddPrimary(Label);
            visualTree.Content.MainPanel.AddPrimary(packageTable);
        }

        /// <summary>
        /// Creates action controls for a package.
        /// </summary>
        /// <param name="renderContext">The render context.</param>
        /// <param name="package">The package.</param>
        /// <param name="apiUri">The API base uri.</param>
        /// <param name="packageIdEscaped">The escaped package id.</param>
        /// <returns>The action panel.</returns>
        private static ControlTableCellPanel CreateActions(IRenderContext renderContext, PackageCatalogItem package, IUri apiUri, string packageIdEscaped)
        {
            var activateUri = BuildUri(apiUri, $"action/activate/{packageIdEscaped}");
            var deactivateUri = BuildUri(apiUri, $"action/deactivate/{packageIdEscaped}");
            var updateUri = BuildUri(apiUri, $"action/update/{packageIdEscaped}");
            var deleteUri = BuildUri(apiUri, $"item/{packageIdEscaped}");
            var actions = new ControlTableCellPanel();

            if (package.State == PackageCatalogeItemState.Active)
            {
                actions.Add(new ControlButton()
                {
                    Text = "webexpress.webapp:setting.plugin.action.deactivate.label",
                    Margin = new PropertySpacingMargin(PropertySpacing.Space.Two),
                    BackgroundColor = new PropertyColorButton(TypeColorButton.Secondary),
                    PrimaryAction = new ActionPluginPackage(new UriEndpoint(deactivateUri), RequestMethod.PUT.ToString())
                    {
                        ConfirmText = I18N.Translate(renderContext, "webexpress.webapp:setting.plugin.action.deactivate.confirm", package.Id)
                    }
                });
            }
            else
            {
                actions.Add(new ControlButton()
                {
                    Text = "webexpress.webapp:setting.plugin.action.activate.label",
                    Margin = new PropertySpacingMargin(PropertySpacing.Space.Two),
                    BackgroundColor = new PropertyColorButton(TypeColorButton.Success),
                    PrimaryAction = new ActionPluginPackage(new UriEndpoint(activateUri), RequestMethod.PUT.ToString())
                    {
                        ConfirmText = I18N.Translate(renderContext, "webexpress.webapp:setting.plugin.action.activate.confirm", package.Id)
                    }
                });
            }

            actions.Add(new ControlButton()
            {
                Text = "webexpress.webapp:setting.plugin.action.update.label",
                Margin = new PropertySpacingMargin(PropertySpacing.Space.Two),
                BackgroundColor = new PropertyColorButton(TypeColorButton.Info),
                PrimaryAction = new ActionPluginPackage(new UriEndpoint(updateUri), RequestMethod.PUT.ToString(), true)
                {
                    ConfirmText = I18N.Translate(renderContext, "webexpress.webapp:setting.plugin.action.update.confirm", package.Id)
                }
            });

            actions.Add(new ControlButton()
            {
                Text = "webexpress.webapp:setting.plugin.action.delete.label",
                Margin = new PropertySpacingMargin(PropertySpacing.Space.Two),
                BackgroundColor = new PropertyColorButton(TypeColorButton.Danger),
                PrimaryAction = new ActionPluginPackage(new UriEndpoint(deleteUri), RequestMethod.DELETE.ToString())
                {
                    ConfirmText = I18N.Translate(renderContext, "webexpress.webapp:setting.plugin.action.delete.confirm", package.Id)
                }
            });

            return actions;
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
