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

namespace WebExpress.WebApp.WWW.Setting.System.Log
{
    /// <summary>
    /// Logging settings page.
    /// </summary>
    [WebIcon<IconFileMedicalAlt>]
    [Title("webexpress.webapp:setting.titel.log.label")]
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

            deleteModal.Confirm += (s, e) =>
            {
                File.Delete(log);
            };

            var switchOnModal = new ControlModalFormConfirm("swich-on-log")
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

            switchOnModal.SubmitButtonColor = new PropertyColorButton(TypeColorButton.Success);
            switchOnModal.SubmitButtonIcon = new IconPowerOff();
            switchOnModal.SubmitButtonLabel = I18N.Translate
            (
                renderContext,
                "webexpress.webapp:setting.logfile.switchon.label"
            );

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
                            Text = log
                        },
                        downloadUri is not null && file.Exists
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
                                Modal = new ModalTarget(deleteModal.Id),
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
                                Modal = new ModalTarget(switchOnModal?.Id),
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
               .AddPrimary(infoTable)
               .AddSecondary(deleteModal)
               .AddSecondary(switchOnModal);

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

