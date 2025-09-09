using System;
using System.IO;
using System.Linq;
using WebExpress.WebApp.WebControl;
using WebExpress.WebApp.WebScope;
using WebExpress.WebApp.WebSettingPage;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebLog;
using WebExpress.WebCore.WebPage;
using WebExpress.WebCore.WebSettingPage;
using WebExpress.WebUI.Internationalization;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebIcon;

namespace WebExpress.WebApp.WWW.Setting.System
{
    /// <summary>
    /// Logging settings page.
    /// </summary>
    [WebIcon<IconFileMedicalAlt>]
    [Title("webexpress.webapp:setting.titel.log.label")]
    [SettingCategory<SettingCategoryGeneral>()]
    [SettingGroup<SettingGroupGeneral>()]
    [SettingSection(SettingSection.Secondary)]
    [Scope<IScopeAdmin>]
    public sealed class Log : ISettingPage<VisualTreeWebAppSetting>, IScopeAdmin
    {
        private readonly ILogManager _logManager;

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="logManager">The log manager.</param>
        public Log(ILogManager logManager)
        {
            _logManager = logManager;
        }

        /// <summary>
        /// Processing of the resource.
        /// </summary>
        /// <param name="renderContext">The context for rendering the page.</param>
        /// <param name="visualTree">The visual tree of the web application.</param>
        public void Process(IRenderContext renderContext, VisualTreeWebAppSetting visualTree)
        {
            var downloadUri = renderContext.Request.Uri.Concat("download");
            var log = _logManager?.DefaultLog.Filename;
            var file = new FileInfo(log);
            var fileSize = string.Format
            (
                new FileSizeFormatProvider()
                {
                    Culture = renderContext?.Request?.Culture
                },
                "{0:fs}",
                file.Exists ? file.Length : 0
            );

            var deleteForm = new ControlModalFormConfirmDelete("delte_log")
            {
                Header = I18N.Translate
                (
                    renderContext,
                    "webexpress.webapp:setting.logfile.delete.header"
                ),
                Content = new ControlFormItemStaticText()
                {
                    Text = I18N.Translate
                    (
                        renderContext,
                        "webexpress.webapp:setting.logfile.delete.description"
                    )
                }
            };

            deleteForm.Confirm += (s, e) =>
            {
                File.Delete(log);
            };

            var switchOnForm = new ControlModalFormConfirm("swichon_log")
            {
                Header = I18N.Translate
                (
                    renderContext,
                    "webexpress.webapp:setting.logfile.switchon.header"
                ),
                Content = new ControlFormItemStaticText()
                {
                    Text = I18N.Translate
                    (
                        renderContext,
                        "webexpress.webapp:setting.logfile.switchon.description"
                    )
                }
            };

            switchOnForm.AddPreferencesButton(new ControlFormItemButtonSubmit()
            {
                Icon = new IconPowerOff(),
                Color = new PropertyColorButton(TypeColorButton.Success),
                Text = I18N.Translate
                (
                    renderContext,
                    "webexpress.webapp:setting.logfile.switchon.label"
                )
            });

            switchOnForm.Confirm += (s, e) =>
            {
                //        context.PluginContext.Host.Log.LogMode = LogMode.Override;
                //        context.PluginContext.Host.Log.Info(this.I18N("webexpress.webapp", "setting.logfile.switchon.success"));
            };

            var info = new ControlTable()
            {
                Striped = TypeStripedTable.Row,
                SuppressHeaders = true
            }
                .AddColumn("")
                .AddColumn("")
                .AddColumn("")
                .AddRow
                (
                        new ControlTableCell()
                        {
                            Text = I18N.Translate
                            (
                                renderContext, "webexpress.webapp:setting.logfile.path"
                            )
                        },
                        new ControlTableCell()
                        {
                            Text = log,
                            //Format = TypeFormatText.Code
                        },
                        downloadUri != null && file.Exists
                            ? new ControlTableCellPanel()
                                .Add(new ControlButtonLink()
                                {
                                    Text = I18N.Translate
                                        (
                                            renderContext,
                                            "webexpress.webapp:setting.logfile.download"
                                        ),
                                    Icon = new IconDownload(),
                                    BackgroundColor = new PropertyColorButton(TypeColorButton.Primary),
                                    Uri = downloadUri
                                })
                            : new ControlTableCell()
                )
                .AddRow
                (
                    new ControlTableCell()
                    {
                        Text = I18N.Translate
                        (
                            renderContext,
                            "webexpress.webapp:setting.logfile.size"
                        )
                    },
                    new ControlTableCell()
                    {
                        Text = file.Exists ? fileSize : "n.a."
                        //Format = TypeFormatText.Code
                    },
                    file.Exists
                        ? new ControlTableCellPanel()
                            .Add(new ControlButton()
                            {
                                Text = I18N.Translate
                                (
                                    renderContext,
                                    "webexpress.webapp:setting.logfile.delete.label"
                                ),
                                Modal = deleteForm.Id,
                                Icon = new IconTrashAlt(),
                                BackgroundColor = new PropertyColorButton(TypeColorButton.Danger)
                            })
                        : new ControlTableCell()
                )
                .AddRow
                (
                    new ControlTableCell()
                    {
                        Text = I18N.Translate
                        (
                            renderContext,
                            "webexpress.webapp:setting.logfile.modus"
                        )
                    },
                    new ControlTableCell()
                    {
                        Text = _logManager?.DefaultLog.LogMode.ToString()
                        //Format = TypeFormatText.Code
                    },
                    _logManager?.DefaultLog.LogMode == LogMode.Off
                        ? new ControlTableCellPanel()
                            .Add(new ControlButton()
                            {
                                Text = I18N.Translate
                                (
                                    renderContext,
                                    "webexpress.webapp:setting.logfile.switchon.label"
                                ),
                                Modal = "#swichon_log",
                                Icon = new IconPowerOff(),
                                BackgroundColor = new PropertyColorButton(TypeColorButton.Success)
                            })
                        : new ControlTableCell()
                );

            visualTree.Content.MainPanel
                .AddPrimary(new ControlText()
                {
                    Text = I18N.Translate
                    (
                        renderContext,
                        "webexpress.webapp:setting.logfile.label"
                    ),
                    TextColor = new PropertyColorText(TypeColorText.Info),
                    Margin = new PropertySpacingMargin(PropertySpacing.Space.Two)
                })
               .AddPrimary(info);

            if (file.Exists)
            {
                var content = File.ReadLines(log).TakeLast(100);

                visualTree.Content.MainPanel
                    .AddPrimary(new ControlText()
                    {
                        Text = I18N.Translate
                        (
                            renderContext,
                            "webexpress.webapp:setting.logfile.extract"
                        ),
                        Format = TypeFormatText.H3
                    })
                    .AddPrimary(new ControlText()
                    {
                        Text = string.Join("<br/>", content.Reverse()),
                        Format = TypeFormatText.Code
                    });
            }
        }
    }
}

