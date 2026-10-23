using System;
using System.Globalization;
using System.Linq;
using System.Net;
using WebExpress.WebApp.WebCondition;
using WebExpress.WebApp.WebScope;
using WebExpress.WebApp.WebSettingPage;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebComponent;
using WebExpress.WebCore.WebEmail;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebPage;
using WebExpress.WebCore.WebPolicies;
using WebExpress.WebCore.WebSettingPage;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebIcon;

namespace WebExpress.WebApp.WWW.Settings.System
{
    /// <summary>
    /// Shows administrators the active email policy and provider availability without exposing credentials.
    /// </summary>
    [WebIcon<IconEnvelope>]
    [Title("webexpress.webapp:setting.title.email.label")]
    [SettingGroup<SettingGroupSystemGeneral>]
    [SettingSection(SettingSection.Secondary)]
    [Scope<IScopeAdmin>]
    [Policy<SystemAccessPolicy>]
    [Condition<ConditionEmailEnabled>]
    public sealed class Email : ISettingPage<VisualTreeWebAppSetting>, IScopeAdmin
    {
        private readonly IEmailManager _emailManager;

        /// <summary>
        /// Uses the shared manager so displayed values match the settings used for actual submissions.
        /// </summary>
        /// <param name="componentHub">The hub supplying the running delivery service.</param>
        public Email(IComponentHub componentHub)
        {
            _emailManager = componentHub.EmailManager;
        }

        /// <summary>
        /// Refreshes provider diagnostics on each request while keeping deployment configuration read-only.
        /// </summary>
        /// <param name="renderContext">The request language and rendering context.</param>
        /// <param name="visualTree">The settings shell receiving the overview.</param>
        public void Process(IRenderContext renderContext, VisualTreeWebAppSetting visualTree)
        {
            var status = _emailManager.GetStatus();
            var panel = visualTree.Content.MainPanel;
            panel.AddPrimary(new ControlText
            {
                Text = _ => "webexpress.webapp:setting.email.description",
                Margin = _ => new PropertySpacingMargin(PropertySpacing.Space.Two)
            });

            var summary = new ControlTable("wx-email-policy") { SuppressHeaders = _ => true, Striped = _ => TypeStripedTable.Row };
            summary.AddColumn("").AddColumn("");
            AddRow(summary, renderContext, "enabled", Translate(renderContext, status.Enabled ? "active" : "disabled"));
            AddRow(summary, renderContext, "default", status.DefaultProfile);
            AddRow(summary, renderContext, "retention", status.DeduplicationHours.ToString(CultureInfo.InvariantCulture));
            AddRow(summary, renderContext, "attachments", status.MaxAttachmentBytes.ToString(CultureInfo.InvariantCulture));
            AddRow(summary, renderContext, "store", Translate(renderContext, status.IsStoreShared ? "shared" : "local"));
            panel.AddPrimary(summary);

            if (status.IsClustered && !status.IsStoreShared)
            {
                panel.AddPrimary(new ControlText
                {
                    Text = _ => "webexpress.webapp:setting.email.clusterblocked",
                    TextColor = _ => new PropertyColorText(TypeColorText.Danger),
                    Margin = _ => new PropertySpacingMargin(PropertySpacing.Space.Two)
                });
            }
            if (!status.Profiles.Any(x => string.Equals(x.Name, status.DefaultProfile, StringComparison.OrdinalIgnoreCase)))
            {
                panel.AddPrimary(new ControlText
                {
                    Text = _ => "webexpress.webapp:setting.email.defaultmissing",
                    Margin = _ => new PropertySpacingMargin(PropertySpacing.Space.Two)
                });
            }
            if (status.Profiles.Count == 0)
            {
                panel.AddPrimary(new ControlEmptyState
                {
                    Icon = _ => new IconEnvelope(),
                    Title = _ => "webexpress.webapp:setting.email.empty.title",
                    Message = _ => "webexpress.webapp:setting.email.empty.message"
                });
                return;
            }

            var profiles = new ControlPanel("wx-email-profiles");
            foreach (var profile in status.Profiles)
            {
                var state = !profile.ConfigurationValid ? "invalid" : !profile.ProviderRegistered ? "missing" : "registered";
                var section = new ControlPanel { Classes = ["border", "rounded", "p-3", "mb-3"] };
                section.Add(new ControlHtml
                {
                    Html = _ => new HtmlElementSectionH3(new HtmlText(WebUtility.HtmlEncode(profile.Name)))
                    {
                        Class = "h5 text-break"
                    }.ToString()
                });
                section.Add(new ControlBadge
                {
                    Value = _ => Translate(renderContext, state),
                    BackgroundColor = _ => new PropertyColorBackgroundBadge(state == "registered"
                        ? TypeColorBackgroundBadge.Success : TypeColorBackgroundBadge.Warning),
                    Classes = ["mb-2"]
                });
                var details = new ControlTable { SuppressHeaders = _ => true, Striped = _ => TypeStripedTable.Row };
                details.AddColumn("").AddColumn("");
                AddRow(details, renderContext, "provider", profile.Provider);
                AddRow(details, renderContext, "sender", profile.From);
                AddRow(details, renderContext, "server", profile.Host is null
                    ? Translate(renderContext, "notapplicable") : $"{profile.Host}:{profile.Port}");
                AddRow(details, renderContext, "security", profile.Security.HasValue
                    ? profile.Security.Value.ToString() : Translate(renderContext, "notapplicable"));
                AddRow(details, renderContext, "authentication", Translate(renderContext, !profile.Security.HasValue
                    ? "notapplicable" : profile.AuthenticationConfigured ? "configured" : "notconfigured"));
                AddRow(details, renderContext, "timeout", profile.TimeoutSeconds.ToString(CultureInfo.InvariantCulture));
                section.Add(details);
                profiles.Add(section);
            }
            panel.AddPrimary(profiles);
            panel.AddPrimary(new ControlText
            {
                Text = _ => "webexpress.webapp:setting.email.validation",
                TextColor = _ => new PropertyColorText(TypeColorText.Secondary),
                Margin = _ => new PropertySpacingMargin(PropertySpacing.Space.Two)
            });
        }

        /// <summary>
        /// Keeps the overview aligned with the standard settings tables.
        /// </summary>
        /// <param name="table">The table receiving the diagnostic field.</param>
        /// <param name="context">The language context for its label.</param>
        /// <param name="key">The label suffix in the email translation namespace.</param>
        /// <param name="value">The literal effective value to display.</param>
        private static void AddRow(ControlTable table, IRenderContext context, string key, string value)
        {
            table.AddRow(Cell(Translate(context, key)), Cell(value));
        }

        /// <summary>
        /// Encodes configuration values as literal text without interpreting them as translation keys.
        /// </summary>
        /// <param name="value">The untrusted configuration value.</param>
        /// <returns>A table cell whose content cannot become executable markup.</returns>
        private static IControlTableCellPanel Cell(string value)
        {
            return new ControlTableCellPanel().Add(new ControlHtml
            {
                Html = _ => new HtmlElementTextSemanticsSpan(new HtmlText(WebUtility.HtmlEncode(value ?? ""))) { Class = "text-break", Style = "white-space: normal" }.ToString()
            });
        }

        /// <summary>
        /// Resolves page labels consistently with the request language.
        /// </summary>
        /// <param name="context">The language context supplied by the settings shell.</param>
        /// <param name="key">The label suffix within the email namespace.</param>
        /// <returns>The translated label.</returns>
        private static string Translate(IRenderContext context, string key)
        {
            return I18N.Translate(context, "webexpress.webapp:setting.email." + key);
        }
    }
}
