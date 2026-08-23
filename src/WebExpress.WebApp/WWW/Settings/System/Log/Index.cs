using System;
using System.IO;
using System.Linq;
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

namespace WebExpress.WebApp.WWW.Settings.System.Log
{
    /// <summary>
    /// Logging settings page.
    /// </summary>
    [WebIcon<IconFileMedicalAlt>]
    [Title("webexpress.webapp:setting.title.log.label")]
    [SettingGroup<SettingGroupSystemGeneral>()]
    [SettingSection(SettingSection.Secondary)]
    [Scope<IScopeAdmin>]
    public sealed class Index : ISettingPage<VisualTreeWebAppSetting>, IScopeAdmin
    {
        private readonly ILogManager _logManager;

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="logManager">The log manager.</param>
        public Index(ILogManager logManager)
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

            var deleteModal = new ControlModalFormConfirmDelete("delte-log")
            {
                Header = _ => I18N.Translate
                (
                    renderContext,
                    "webexpress.webapp:setting.logfile.delete.header"
                ),
                Content = new ControlFormItemStaticText()
                {
                    Text = _ => I18N.Translate
                    (
                        renderContext,
                        "setting.logfile.delete.description"
                    )
                }
            };

            deleteModal.Confirm += (s, e) =>
            {
                File.Delete(log);
            };

            var switchOnModal = new ControlModalFormConfirm("swich-on-log")
            {
                Header = _ => I18N.Translate
                (
                    renderContext,
                    "webexpress.webapp:setting.logfile.switchon.header"
                ),
                Content = new ControlFormItemStaticText()
                {
                    Text = _ => I18N.Translate
                    (
                        renderContext,
                        "webexpress.webapp:setting.logfile.switchon.description"
                    )
                },
                SubmitButtonColor = _ => new PropertyColorButton(TypeColorButton.Success),
                SubmitButtonIcon = _ => new IconPowerOff(),
                SubmitButtonLabel = _ => I18N.Translate
                (
                    renderContext,
                    "webexpress.webapp:setting.logfile.switchon.label"
                )
            };

            switchOnModal.Confirm += (s, e) =>
            {
                _logManager.DefaultLog.LogMode = LogMode.Override;
                _logManager.DefaultLog.Info(I18N.Translate
                (
                    renderContext,
                    "webexpress.webapp:setting.logfile.switchon.success"
                ));
            };

            var infoTable = new ControlTable()
            {
                Striped = _ => TypeStripedTable.Row,
                SuppressHeaders = _ => true
            }
                .AddColumn("")
                .AddColumn("")
                .AddColumn("")
                .AddRow
                (
                        new ControlTableCell()
                        {
                            Text = _ => I18N.Translate
                            (
                                renderContext, "webexpress.webapp:setting.logfile.path"
                            )
                        },
                        new ControlTableCell()
                        {
                            Text = _ => log
                        },
                        downloadUri is not null && file.Exists
                            ? new ControlTableCellPanel()
                                .Add(new ControlButtonLink()
                                {
                                    Text = (c) => I18N.Translate
                                        (
                                            renderContext,
                                            "webexpress.webapp:setting.logfile.download"
                                        ),
                                    Icon = _ => new IconDownload(),
                                    BackgroundColor = _ => new PropertyColorButton(TypeColorButton.Primary),
                                    Uri = _ => downloadUri
                                })
                            : new ControlTableCell()
                )
                .AddRow
                (
                    new ControlTableCell()
                    {
                        Text = _ => I18N.Translate
                        (
                            renderContext,
                            "webexpress.webapp:setting.logfile.size"
                        )
                    },
                    new ControlTableCell()
                    {
                        Text = _ => file.Exists ? fileSize : "n.a."
                        //Format = TypeFormatText.Code
                    },
                    file.Exists
                        ? new ControlTableCellPanel()
                            .Add(new ControlButton()
                            {
                                Text = (c) => I18N.Translate
                                (
                                    renderContext,
                                    "webexpress.webapp:setting.logfile.delete.label"
                                ),
                                PrimaryAction = _ => new ActionModal(deleteModal.Id),
                                Icon = _ => new IconTrash(),
                                BackgroundColor = _ => new PropertyColorButton(TypeColorButton.Danger)
                            })
                        : new ControlTableCell()
                )
                .AddRow
                (
                    new ControlTableCell()
                    {
                        Text = _ => I18N.Translate
                        (
                            renderContext,
                            "webexpress.webapp:setting.logfile.modus"
                        )
                    },
                    new ControlTableCell()
                    {
                        Text = _ => _logManager?.DefaultLog.LogMode.ToString()
                        //Format = TypeFormatText.Code
                    },
                    _logManager?.DefaultLog.LogMode == LogMode.Off
                        ? new ControlTableCellPanel()
                            .Add(new ControlButton()
                            {
                                Text = (c) => I18N.Translate
                                (
                                    renderContext,
                                    "webexpress.webapp:setting.logfile.switchon.label"
                                ),
                                PrimaryAction = _ => new ActionModal(switchOnModal?.Id),
                                Icon = _ => new IconPowerOff(),
                                BackgroundColor = _ => new PropertyColorButton(TypeColorButton.Success)
                            })
                        : new ControlTableCell()
                );

            visualTree.Content.MainPanel
                .AddPrimary(new ControlText()
                {
                    Text = _ => I18N.Translate
                    (
                        renderContext,
                        "webexpress.webapp:setting.logfile.label"
                    ),
                    TextColor = _ => new PropertyColorText(TypeColorText.Info),
                    Margin = _ => new PropertySpacingMargin(PropertySpacing.Space.Two)
                })
               .AddPrimary(infoTable)
               .AddSecondary(deleteModal)
               .AddSecondary(switchOnModal);

            if (file.Exists)
            {
                var content = File.ReadLines(log).TakeLast(100);

                visualTree.Content.MainPanel
                    .AddPrimary(new ControlText()
                    {
                        Text = _ => I18N.Translate
                        (
                            renderContext,
                            "webexpress.webapp:setting.logfile.extract"
                        ),
                        Format = _ => TypeFormatText.H3
                    })
                    .AddPrimary(new ControlText()
                    {
                        Text = _ => string.Join("<br/>", content.Reverse()),
                        Format = _ => TypeFormatText.Code
                    });
            }
        }
    }
}

