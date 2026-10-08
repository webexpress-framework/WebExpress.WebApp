using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Net;
using WebExpress.WebApp.WebScope;
using WebExpress.WebApp.WebSettingPage;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebCertificate;
using WebExpress.WebCore.WebComponent;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebPage;
using WebExpress.WebCore.WebPolicies;
using WebExpress.WebCore.WebSettingPage;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebIcon;

namespace WebExpress.WebApp.WWW.Settings.System
{
    /// <summary>
    /// Gives administrators certificate diagnostics through the manager without exposing credentials or key material.
    /// </summary>
    [WebIcon<IconCertificate>]
    [Title("webexpress.webapp:setting.title.certificate.label")]
    [SettingGroup<SettingGroupSystemGeneral>]
    [SettingSection(SettingSection.Secondary)]
    [Scope<IScopeAdmin>]
    [Policy<SystemAccessPolicy>]
    public sealed class Certificates : ISettingPage<VisualTreeWebAppSetting>, IScopeAdmin
    {
        private readonly ICertificateManager _certificateManager;

        /// <summary>
        /// Shares the host inventory so the page cannot diverge from the certificates managed by the server.
        /// </summary>
        /// <param name="componentHub">The component hub providing the host-owned certificate manager.</param>
        public Certificates(IComponentHub componentHub)
        {
            _certificateManager = componentHub.CertificateManager;
        }

        /// <summary>
        /// Takes a fresh metadata snapshot for each page request while leaving certificate deployment to configuration.
        /// </summary>
        /// <param name="renderContext">The request context supplying the administrator's language and date format.</param>
        /// <param name="visualTree">The settings shell receiving the certificate overview.</param>
        public void Process(IRenderContext renderContext, VisualTreeWebAppSetting visualTree)
        {
            var panel = visualTree.Content.MainPanel;
            var certificates = _certificateManager.GetCertificates()
                .OrderBy(x => x.IsUsable)
                .ThenByDescending(x => x.Status.HasFlag(CertificateStatus.ExpiringSoon))
                .ThenBy(x => x.NotAfter)
                .ThenBy(x => x.Alias, StringComparer.OrdinalIgnoreCase)
                .ToList();

            panel.AddPrimary(new ControlText
            {
                Text = _ => "webexpress.webapp:setting.certificate.description",
                Margin = _ => new PropertySpacingMargin(PropertySpacing.Space.Two)
            });

            if (certificates.Count == 0)
            {
                panel.AddPrimary(new ControlEmptyState
                {
                    Icon = _ => new IconCertificate(),
                    Title = _ => "webexpress.webapp:setting.certificate.empty.title",
                    Message = _ => "webexpress.webapp:setting.certificate.empty.message"
                });
                return;
            }

            panel.AddPrimary(new ControlPanel { Classes = ["d-flex", "flex-wrap", "gap-2", "m-2"] }.Add
            (
                CreateBadge(renderContext, "webexpress.webapp:setting.certificate.summary.total", TypeColorBackgroundBadge.Secondary, certificates.Count),
                CreateBadge(renderContext, "webexpress.webapp:setting.certificate.summary.usable", TypeColorBackgroundBadge.Success, certificates.Count(x => x.IsUsable)),
                CreateBadge(renderContext, "webexpress.webapp:setting.certificate.summary.expiring", TypeColorBackgroundBadge.Warning,
                    certificates.Count(x => x.IsUsable && x.Status.HasFlag(CertificateStatus.ExpiringSoon))),
                CreateBadge(renderContext, "webexpress.webapp:setting.certificate.summary.unusable", TypeColorBackgroundBadge.Danger, certificates.Count(x => !x.IsUsable))
            ));

            var table = new ControlTable("wx-certificates") { Striped = _ => TypeStripedTable.Row };
            foreach (var column in new[] { "certificate", "hosts", "issuer", "validfrom", "expires", "status" })
            {
                table.AddColumn(I18N.Translate(renderContext, $"webexpress.webapp:setting.certificate.column.{column}"));
            }
            table.AddRows(certificates.Select(x => CreateRow(renderContext, x)));
            panel.AddPrimary(table);
            panel.AddPrimary(new ControlText
            {
                Text = _ => "webexpress.webapp:setting.certificate.validation.message",
                TextColor = _ => new PropertyColorText(TypeColorText.Secondary),
                Margin = _ => new PropertySpacingMargin(PropertySpacing.Space.Two)
            });
        }

        /// <summary>
        /// Renders one metadata snapshot with encoded certificate fields and independently visible failure flags.
        /// </summary>
        /// <param name="renderContext">The language and formatting context for labels and validity dates.</param>
        /// <param name="certificate">The credential-free snapshot returned by the certificate manager.</param>
        /// <returns>The overview row for the configured certificate.</returns>
        private static IControlTableRow CreateRow(IRenderContext renderContext, CertificateInfo certificate)
        {
            var identity = new ControlTableCellPanel { Class = _ => "wx-table-cell-stack" };
            // aliases may resemble translation keys and must retain their literal identity
            identity.Add(new ControlHtml
            {
                Html = _ => new HtmlElementTextSemanticsB(WebUtility.HtmlEncode(certificate.Alias))
                {
                    Class = "text-break"
                }.ToString()
            });
            identity.Add(CreateDetail(renderContext, "store", certificate.Store));
            if (!string.IsNullOrWhiteSpace(certificate.Subject))
            {
                identity.Add(CreateDetail(renderContext, "subject", certificate.Subject));
            }
            if (!string.IsNullOrWhiteSpace(certificate.Thumbprint))
            {
                identity.Add(CreateDetail(renderContext, "thumbprint", certificate.Thumbprint));
            }

            return new ControlTableRow().Add
            (
                identity,
                new ControlTableCell { Text = _ => FormatText(renderContext, string.Join(", ", certificate.HostNames)) },
                new ControlTableCell { Text = _ => FormatText(renderContext, certificate.Issuer) },
                new ControlTableCell { Text = _ => FormatDate(renderContext, certificate.NotBefore) },
                new ControlTableCell { Text = _ => FormatDate(renderContext, certificate.NotAfter) },
                new ControlTableCellPanel { Class = _ => "wx-table-cell-stack" }.Add(CreateStatusBadges(renderContext, certificate.Status))
            );
        }

        /// <summary>
        /// Keeps long identifiers readable and encodes externally supplied distinguished names before rendering.
        /// </summary>
        /// <param name="renderContext">The language context for the field label.</param>
        /// <param name="field">The metadata field whose label is translated.</param>
        /// <param name="value">The untrusted certificate or provider text to display.</param>
        /// <returns>A labeled secondary text control.</returns>
        private static ControlText CreateDetail(IRenderContext renderContext, string field, string value)
        {
            return new ControlText
            {
                Text = _ => WebUtility.HtmlEncode(I18N.Translate(renderContext, $"webexpress.webapp:setting.certificate.detail.{field}", value)),
                TextColor = _ => new PropertyColorText(TypeColorText.Secondary),
                Size = _ => new PropertySizeText(TypeSizeText.Small),
                Classes = ["text-break"]
            };
        }

        /// <summary>
        /// Distinguishes warnings from blocking failures without making color the only status indicator.
        /// </summary>
        /// <param name="renderContext">The language context for the status labels.</param>
        /// <param name="status">The combined suitability flags returned by the certificate manager.</param>
        /// <returns>The translated badges for every reported status flag.</returns>
        private static IEnumerable<IControl> CreateStatusBadges(IRenderContext renderContext, CertificateStatus status)
        {
            if (status == CertificateStatus.Valid)
            {
                yield return CreateBadge(renderContext, "webexpress.webapp:setting.certificate.status.valid", TypeColorBackgroundBadge.Success);
                yield break;
            }

            foreach (var flag in Enum.GetValues<CertificateStatus>().Where(x => x != CertificateStatus.Valid && status.HasFlag(x)))
            {
                yield return CreateBadge(renderContext, $"webexpress.webapp:setting.certificate.status.{flag.ToString().ToLowerInvariant()}",
                    flag == CertificateStatus.ExpiringSoon ? TypeColorBackgroundBadge.Warning : TypeColorBackgroundBadge.Danger);
            }
        }

        /// <summary>
        /// Uses the standard status badge component for consistent theme and accessibility behavior.
        /// </summary>
        /// <param name="renderContext">The language context used to format the label.</param>
        /// <param name="key">The translation key for the badge.</param>
        /// <param name="color">The semantic status color.</param>
        /// <param name="args">The optional summary counts inserted into the label.</param>
        /// <returns>The translated status badge.</returns>
        private static ControlBadge CreateBadge(IRenderContext renderContext, string key, TypeColorBackgroundBadge color, params object[] args)
        {
            return new ControlBadge
            {
                Value = _ => I18N.Translate(renderContext, key, args),
                BackgroundColor = _ => new PropertyColorBackgroundBadge(color),
                Pill = _ => TypePillBadge.Pill
            };
        }

        /// <summary>
        /// Avoids mixing server and browser time zones when administrators compare certificate validity dates.
        /// </summary>
        /// <param name="renderContext">The request culture used for the date and time representation.</param>
        /// <param name="value">The UTC validity boundary, or null when the certificate could not be loaded.</param>
        /// <returns>The encoded date with an explicit UTC label or an unavailable label.</returns>
        private static string FormatDate(IRenderContext renderContext, DateTimeOffset? value)
        {
            return FormatText(renderContext, value?.UtcDateTime.ToString("g", renderContext.Request.Culture ?? CultureInfo.InvariantCulture)
                + (value.HasValue ? " UTC" : null));
        }

        /// <summary>
        /// Prevents certificate metadata from becoming markup while making missing values explicit.
        /// </summary>
        /// <param name="renderContext">The language context for the missing-value label.</param>
        /// <param name="value">The untrusted metadata value.</param>
        /// <returns>The HTML-encoded text suitable for the table's text nodes.</returns>
        private static string FormatText(IRenderContext renderContext, string value)
        {
            return WebUtility.HtmlEncode(string.IsNullOrWhiteSpace(value)
                ? I18N.Translate(renderContext, "webexpress.webapp:setting.certificate.unavailable") : value);
        }
    }
}
