using System;
using System.Linq;
using WebExpress.WebApp.WebApiControl;
using WebExpress.WebApp.WebScope;
using WebExpress.WebApp.WebSettingPage;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebComponent;
using WebExpress.WebCore.WebPage;
using WebExpress.WebCore.WebSettingPage;
using WebExpress.WebCore.WebTask;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebIcon;

namespace WebExpress.WebApp.WWW.Settings.System
{
    /// <summary>
    /// Settings page with information about the active plugins.
    /// </summary>
    [WebIcon<IconPuzzlePiece>]
    [Title("webexpress.webapp:setting.titel.plugin.label")]
    [SettingGroup<SettingGroupSystemGeneral>()]
    [SettingSection(SettingSection.Secondary)]
    [Scope<IScopeAdmin>]
    public sealed class Plugin : ISettingPage<VisualTreeWebAppSetting>, IScopeAdmin
    {
        private readonly IComponentHub _componentHub;

        /// <summary>
        /// The id of the web task for importing a plugin.
        /// </summary>
        private const string TaskId = "wx-plugin-upload";

        /// <summary>
        /// Returns the label control.
        /// </summary>
        private ControlText Label { get; } = new ControlText()
        {
            Text = "webexpress.webapp:setting.plugin.label",
            Margin = new PropertySpacingMargin(PropertySpacing.Space.Two),
            TextColor = new PropertyColorText(TypeColorText.Info)
        };

        /// <summary>
        /// Returns the help text control.
        /// </summary>
        private ControlText Description { get; } = new ControlText()
        {
            Text = "webexpress.webapp:setting.plugin.description",
            Margin = new PropertySpacingMargin(PropertySpacing.Space.Two)
        };

        /// <summary>
        /// Returns the upload button for uploading and initializing a plugin.
        /// </summary>
        private ControlButton DownloadButton { get; } = new ControlButton()
        {
            Text = "webexpress.webapp:setting.plugin.upload.label",
            Margin = new PropertySpacingMargin(PropertySpacing.Space.Two),
            BackgroundColor = new PropertyColorButton(TypeColorButton.Primary),
            Icon = new IconUpload(),
            PrimaryAction = new ActionModal("plugin-upload"),
            Active = TypeActive.Disabled
        };

        /// <summary>
        /// Form for uploading a plugin.
        /// </summary>
        private ControlModalFormFileUpload ModalUploadForm { get; } = new ControlModalFormFileUpload("plugin-upload")
        {
            Header = "webexpress.webapp:setting.plugin.upload.header"
        };

        /// <summary>
        /// Progress control to monitor plugin initialization.
        /// </summary>
        private ControlRestProgressTask ProgressTask { get; } = new ControlRestProgressTask(TaskId)
        {
            Display = TypeDisplay.None,
            ShowOnStart = true,
            HideOnFinish = true
        };

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="componentHub">
        /// The component hub responsible for registering and resolving components.
        /// </param>
        public Plugin(IComponentHub componentHub)
        {
            _componentHub = componentHub;

            ModalUploadForm.UploadForm += OnUpload;
            ModalUploadForm.Prologue = new ControlFormItemStaticText()
            {
                Text = "webexpress.webapp:setting.plugin.upload.help"
            };
            //ModalUploadForm.File.AcceptFile = new string[] { ".dll" };
        }

        /// <summary>
        /// Called when an upload is to take place.
        /// </summary>
        /// <param name="eventArgs">The event argument.</param>
        private void OnUpload(ControlFormEventFormUpload eventArgs)
        {
            var task = _componentHub.TaskManager.CreateTask(TaskId, OnTaskProcess, eventArgs);
            task.Run();
        }

        /// <summary>
        /// Execution of the WebTask.
        /// </summary>
        /// <param name="sender">The trigger.</param>
        /// <param name="eventArgs">The event argument.</param>
        private void OnTaskProcess(object sender, EventArgs eventArgs)
        {
            var task = sender as Task;
            var args = task.Arguments.FirstOrDefault() as ControlFormEventFormUpload;
            var file = args?.File;
            var context = args?.Context as RenderContext;

            // determine any installed package
            //var plugin = _componentHub.PluginManager.GetPluginByFileName(file.Value);

            //if (plugin is null)
            //    //{
            //    //    var host = context.Host;
            //    //}
            //    //else if (Directory.Exists(plugin.Assembly.Location))
            //    //{
            //    //    // Datei entfernen
            //    //    Directory.Delete(plugin.Assembly.Location);
            //    //}


            // Plugin aus Rgistrierung entfernen
            //    //PluginManager.Unsubscribe(file.Value);

            //for (int i = 0; i < 100; i++)
            //{
            //    Thread.Sleep(1000);
            //    task.Progress = i;
            //    task.Message = "ABC" + i;
            //}
        }

        /// <summary>
        /// Processing of the resource.
        /// </summary>
        /// <param name="renderContext">The context for rendering the page.</param>
        /// <param name="visualTree">The visual tree of the web application.</param>
        public void Process(IRenderContext renderContext, VisualTreeWebAppSetting visualTree)
        {
            var pluginTable = new ControlTable() { Striped = TypeStripedTable.Row };
            pluginTable.AddColumn("");
            pluginTable.AddColumn(I18N.Translate
            (
                renderContext,
                "webexpress.webapp:setting.plugin.name.label")
            );
            pluginTable.AddColumn(I18N.Translate
            (
                renderContext,
                "webexpress.webapp:setting.plugin.version.label"
            ));

            foreach (var application in _componentHub.ApplicationManager.Applications)
            {
                var plugin = application.PluginContext;

                pluginTable.AddRow
                (
                    new ControlTableCellPanel()
                        .Add
                        (
                            new ControlImage()
                            {
                                Uri = application.Icon?.ToUri() ?? null,
                                Width = 32
                            }
                        ),
                    new ControlTableCellPanel()
                        .Add
                        (
                            new ControlLink()
                            {
                                Text = I18N.Translate
                                (
                                    renderContext,
                                    application.ApplicationName
                                ),
                                Uri = application.Route.ToUri()
                            },
                            new ControlText()
                            {
                                Text = string.Format(I18N.Translate
                                (
                                    renderContext,
                                    "webexpress.webapp:setting.plugin.manufacturer.label"
                                ), plugin.Manufacturer),
                                Format = TypeFormatText.Default,
                                TextColor = new PropertyColorText(TypeColorText.Secondary),
                                Margin = new PropertySpacingMargin(PropertySpacing.Space.Two, PropertySpacing.Space.Null),
                                Size = new PropertySizeText(TypeSizeText.Small)
                            },
                            !string.IsNullOrWhiteSpace(plugin.Copyright) ? new ControlText()
                            {
                                Text = string.Format(I18N.Translate
                                (
                                    renderContext,
                                    "webexpress.webapp:setting.plugin.copyright.label"
                                ), plugin.Copyright),
                                Format = TypeFormatText.Default,
                                TextColor = new PropertyColorText(TypeColorText.Secondary),
                                Margin = new PropertySpacingMargin(PropertySpacing.Space.Two, PropertySpacing.Space.Null),
                                Size = new PropertySizeText(TypeSizeText.Small)
                            } : null,
                            !string.IsNullOrWhiteSpace(plugin.License) ? new ControlText()
                            {
                                Text = string.Format(I18N.Translate
                                (
                                    renderContext,
                                    "webexpress.webapp:setting.plugin.license.label"
                                ), plugin.License),
                                Format = TypeFormatText.Default,
                                TextColor = new PropertyColorText(TypeColorText.Secondary),
                                Margin = new PropertySpacingMargin(PropertySpacing.Space.Two, PropertySpacing.Space.Null),
                                Size = new PropertySizeText(TypeSizeText.Small)
                            } : null,
                            new ControlText()
                            {
                                Text = string.Format(I18N.Translate
                                (
                                    renderContext,
                                    "webexpress.webapp:setting.plugin.description.label"
                                ), I18N.Translate
                                (
                                    renderContext,
                                    application.Description
                                )),
                                Format = TypeFormatText.Default,
                                TextColor = new PropertyColorText(TypeColorText.Secondary),
                                Margin = new PropertySpacingMargin(PropertySpacing.Space.Two, PropertySpacing.Space.Null),
                                Size = new PropertySizeText(TypeSizeText.Small)
                            }
                        ),
                    new ControlTableCellPanel()
                        .Add
                        (
                            new ControlText()
                            {
                                Text = plugin.Version,
                                Format = TypeFormatText.Code
                            }
                        )
                );
            }

            visualTree.Content.MainPanel.Headline.AddSecondary(DownloadButton);
            visualTree.Content.MainPanel.AddPreferences(ProgressTask);
            visualTree.Content.MainPanel.AddPrimary(Description);
            visualTree.Content.MainPanel.AddPrimary(Label);
            visualTree.Content.MainPanel.AddPrimary(pluginTable);
            visualTree.Content.MainPanel.AddSecondary(ModalUploadForm);
        }
    }
}

