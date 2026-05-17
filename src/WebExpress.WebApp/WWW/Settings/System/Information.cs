using System;
using System.ComponentModel;
using System.Reflection;
using WebExpress.WebApp.WebScope;
using WebExpress.WebApp.WebSettingPage;
using WebExpress.WebCore;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebPage;
using WebExpress.WebCore.WebSettingPage;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebIcon;

namespace WebExpress.WebApp.WWW.Settings.System
{
    /// <summary>
    /// Settings page with system information.
    /// </summary>
    [WebIcon<IconInfoCircle>]
    [Title("webexpress.webapp:setting.title.systeminformation.label")]
    [SettingGroup<SettingGroupSystemGeneral>()]
    [SettingSection(SettingSection.Secondary)]
    [Scope<IScopeAdmin>]
    public sealed class Information : ISettingPage<VisualTreeWebAppSetting>, IScopeAdmin
    {
        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        public Information()
        {
        }

        /// <summary>
        /// Processing of the resource.
        /// </summary>
        /// <param name="renderContext">The context for rendering the page.</param>
        /// <param name="visualTree">The visual tree of the web application.</param>
        public void Process(IRenderContext renderContext, VisualTreeWebAppSetting visualTree)
        {
            var converter = new TimeSpanConverter();
            var version = typeof(HttpServer).Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion;
            var memoryBytes = GC.GetTotalMemory(true);
            var memory = memoryBytes / (1024 * 1024.0);

            var serverTable = new ControlTable()
            {
                Striped = _ => TypeStripedTable.Row,
                SuppressHeaders = _ => true
            }
                .AddColumn("")
                .AddColumn("")
                .AddRow
                (
                    new ControlTableCell()
                    {
                        Text = _ => I18N.Translate
                        (
                            renderContext,
                            "webexpress.webapp:setting.systeminformation.group.server.version"
                        )
                    },
                    new ControlTableCellPanel().Add(new ControlText()
                    {
                        Text = _ => version,
                        Format = _ => TypeFormatText.Code
                    })
                )
                .AddRow
                (
                    new ControlTableCell()
                    {
                        Text = _ => I18N.Translate
                        (
                            renderContext,
                            "webexpress.webapp:setting.systeminformation.group.server.systemdate"
                        )
                    },
                    new ControlTableCellPanel().Add(new ControlText()
                    {
                        Text = _ => DateTime.Now.ToString
                        (
                            renderContext.Request.Culture.DateTimeFormat.LongDatePattern
                        ),
                        Format = _ => TypeFormatText.Code
                    })
                );

            serverTable.AddRow
            (
                new ControlTableCell()
                {
                    Text = _ => I18N.Translate
                    (
                        renderContext,
                        "webexpress.webapp:setting.systeminformation.group.server.systemtime"
                    )
                },
                new ControlTableCellPanel().Add(new ControlText()
                {
                    Text = _ => DateTime.Now.ToString
                    (
                        renderContext.Request.Culture.DateTimeFormat.LongTimePattern
                    ),
                    Format = _ => TypeFormatText.Code
                })
            );

            serverTable.AddRow
            (
                new ControlTableCell()
                {
                    Text = _ => I18N.Translate
                    (
                        renderContext,
                        "webexpress.webapp:setting.systeminformation.group.server.basisurl"
                    )
                },
                new ControlTableCellPanel().Add(new ControlText()
                {
                    Text = _ => renderContext.Uri?.BasePath?.GetDisplayText(renderContext)
                        ?? renderContext.Uri?.GetDisplayText(renderContext),
                    Format = _ => TypeFormatText.Code
                })
            );

            serverTable.AddRow
            (
                new ControlTableCell()
                {
                    Text = _ => I18N.Translate
                    (
                        renderContext,
                        "webexpress.webapp:setting.systeminformation.group.server.currentdirectory"
                    )
                },
                new ControlTableCellPanel().Add(new ControlText()
                {
                    Text = _ => Environment.CurrentDirectory,
                    Format = _ => TypeFormatText.Code
                })
            );

            serverTable.AddRow
            (
                new ControlTableCell()
                {
                    Text = _ => I18N.Translate
                    (
                        renderContext,
                        "webexpress.webapp:setting.systeminformation.group.server.memory"
                    )
                },
                new ControlTableCellPanel().Add(new ControlText()
                {
                    Text = _ => $"{memory.ToString("N2", renderContext.Request.Culture)} MB",
                    Format = _ => TypeFormatText.Code
                })
            );

            serverTable.AddRow
            (
                new ControlTableCell()
                {
                    Text = _ => I18N.Translate
                    (
                        renderContext,
                        "webexpress.webapp:setting.systeminformation.group.server.executiontime"
                    )
                },
                new ControlTableCellPanel().Add(new ControlText()
                {
                    Text = _ => (converter.ConvertTo(null, renderContext.Request.Culture, DateTime.Now - HttpServer.ExecutionTime, typeof(string))?.ToString()),
                    Format = _ => TypeFormatText.Code
                })
            );

            visualTree.Content.MainPanel.AddPrimary(new ControlText()
            {
                Text = _ => I18N.Translate
                (
                    renderContext,
                    "webexpress.webapp:setting.systeminformation.group.server.label"
                ),
                TextColor = _ => new PropertyColorText(TypeColorText.Info),
                Margin = _ => new PropertySpacingMargin(PropertySpacing.Space.Two)
            });
            visualTree.Content.MainPanel.AddPrimary(serverTable);

            var environmentTable = new ControlTable()
            {
                Striped = _ => TypeStripedTable.Row,
                SuppressHeaders = _ => true
            }
                .AddColumn("")
                .AddColumn("")
                .AddRow
                (
                    new ControlTableCell()
                    {
                        Text = _ => I18N.Translate
                        (
                            renderContext,
                            "webexpress.webapp:setting.systeminformation.group.environment.operatingsystem"
                        )
                    },
                    new ControlTableCellPanel().Add(new ControlText()
                    {
                        Text = _ => Environment.OSVersion.ToString(),
                        Format = _ => TypeFormatText.Code
                    })
                )
                .AddRow
                (
                    new ControlTableCell()
                    {
                        Text = _ => I18N.Translate
                        (
                            renderContext,
                            "webexpress.webapp:setting.systeminformation.group.environment.machinename"
                        )
                    },
                    new ControlTableCellPanel().Add(new ControlText()
                    {
                        Text = _ => Environment.MachineName,
                        Format = _ => TypeFormatText.Code
                    })
                )
                .AddRow
                (
                    new ControlTableCell()
                    {
                        Text = _ => I18N.Translate
                        (
                            renderContext,
                            "webexpress.webapp:setting.systeminformation.group.environment.processorcount"
                        )
                    },
                    new ControlTableCellPanel().Add(new ControlText()
                    {
                        Text = _ => Environment.ProcessorCount.ToString(renderContext.Request.Culture),
                        Format = _ => TypeFormatText.Code
                    })
                )
                .AddRow
                (
                    new ControlTableCell()
                    {
                        Text = _ => I18N.Translate
                        (
                            renderContext,
                            "webexpress.webapp:setting.systeminformation.group.environment.64bit"
                        )
                    },
                    new ControlTableCellPanel().Add(new ControlText()
                    {
                        Text = _ => Environment.Is64BitOperatingSystem.ToString(),
                        Format = _ => TypeFormatText.Code
                    })
                )
                .AddRow
                (
                    new ControlTableCell()
                    {
                        Text = _ => I18N.Translate
                        (
                            renderContext,
                            "webexpress.webapp:setting.systeminformation.group.environment.username"
                        )
                    },
                    new ControlTableCellPanel().Add(new ControlText()
                    {
                        Text = _ => Environment.UserName,
                        Format = _ => TypeFormatText.Code
                    })
                )
                .AddRow
                (
                    new ControlTableCell()
                    {
                        Text = _ => I18N.Translate
                        (
                            renderContext,
                            "webexpress.webapp:setting.systeminformation.group.environment.clr"
                        )
                    },
                    new ControlTableCellPanel().Add(new ControlText()
                    {
                        Text = _ => Environment.Version.ToString(),
                        Format = _ => TypeFormatText.Code
                    })
                );

            visualTree.Content.MainPanel.AddPrimary(new ControlText()
            {
                Text = _ => I18N.Translate
                (
                    renderContext,
                    "webexpress.webapp:setting.systeminformation.group.environment.label"
                ),
                TextColor = _ => new PropertyColorText(TypeColorText.Info),
                Margin = _ => new PropertySpacingMargin(PropertySpacing.Space.Two)
            });
            visualTree.Content.MainPanel.AddPrimary(environmentTable);
        }
    }
}

