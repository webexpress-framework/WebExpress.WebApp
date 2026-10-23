using System.Collections.Generic;
using System.Linq;
using System.Net;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using WebExpress.WebApp.WebControl;
using WebExpress.WebApp.WebScope;
using WebExpress.WebApp.WebSettingPage;
using WebExpress.WebCore;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebPage;
using WebExpress.WebCore.WebPolicies;
using WebExpress.WebCore.WebSettingPage;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebIcon;

namespace WebExpress.WebApp.WWW.Settings.System
{
    /// <summary>
    /// Shows administrators the security protections the server actually applies - headers,
    /// cookie attributes, cross-site request checks and protocols. The values are read from the
    /// running server rather than from the configuration file, so a typo or a dropped HTTP/3
    /// shows up here instead of silently weakening the deployment. Changes stay a matter of
    /// configuration and a restart; the page is read-only on purpose.
    /// </summary>
    [WebIcon<IconShieldHalved>]
    [Title("webexpress.webapp:setting.title.security.label")]
    [SettingGroup<SettingGroupSystemGeneral>]
    [SettingSection(SettingSection.Secondary)]
    [Scope<IScopeAdmin>]
    [Policy<SystemAccessPolicy>]
    public sealed class Security : ISettingPage<VisualTreeWebAppSetting>, IScopeAdmin
    {
        private readonly HttpServer _server;

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="httpServerContext">The server context whose host holds the effective security policy.</param>
        public Security(IHttpServerContext httpServerContext)
        {
            _server = httpServerContext?.Host as HttpServer;
        }

        /// <summary>
        /// Renders a fresh snapshot of the effective protections for each request.
        /// </summary>
        /// <param name="renderContext">The context for rendering the page.</param>
        /// <param name="visualTree">The settings shell receiving the overview.</param>
        public void Process(IRenderContext renderContext, VisualTreeWebAppSetting visualTree)
        {
            // without a running server the built-in defaults are what would apply
            var headers = _server?.SecurityHeaders ?? SecurityHeaders.Default;
            var guard = _server?.OriginGuard ?? new RequestOriginGuard(null);
            var panel = visualTree.Content.MainPanel;

            panel.AddPrimary(new ControlText
            {
                Text = _ => "webexpress.webapp:setting.security.description",
                Margin = _ => new PropertySpacingMargin(PropertySpacing.Space.Two)
            });

            AddSection(renderContext, panel, "headers", CreateHeaderRows(renderContext, headers));
            AddSection(renderContext, panel, "cookies", CreateCookieRows(renderContext, headers));
            AddSection(renderContext, panel, "csrf", CreateCsrfRows(renderContext, guard));
            AddSection(renderContext, panel, "protocols", CreateProtocolRows(renderContext));

            panel.AddPrimary(new ControlText
            {
                Text = _ => "webexpress.webapp:setting.security.configuration.message",
                TextColor = _ => new PropertyColorText(TypeColorText.Secondary),
                Margin = _ => new PropertySpacingMargin(PropertySpacing.Space.Two)
            });
        }

        /// <summary>
        /// Creates the rows of the response headers, the content security policy first because it
        /// is the protection most likely to be loosened.
        /// </summary>
        /// <param name="renderContext">The context for rendering the page.</param>
        /// <param name="headers">The effective security headers.</param>
        /// <returns>The table rows.</returns>
        private static IEnumerable<IControlTableRow> CreateHeaderRows(IRenderContext renderContext, SecurityHeaders headers)
        {
            var policy = headers.ContentSecurityPolicy;

            yield return CreateRow(renderContext, "csp", policy is null
                ? CreateBadge(renderContext, "off", TypeColorBackgroundBadge.Danger)
                : headers.ContentSecurityPolicyReportOnly
                    ? CreateBadge(renderContext, "reportonly", TypeColorBackgroundBadge.Warning)
                    : CreateBadge(renderContext, "enforced", TypeColorBackgroundBadge.Success));

            if (policy is not null)
            {
                // one directive per line keeps a long policy scannable
                yield return CreateRow(renderContext, "csp.policy", CreateCode(policy
                    .Split(';')
                    .Select(x => x.Trim())
                    .Where(x => x.Length > 0)));
            }

            yield return CreateRow(renderContext, "hsts", headers.StrictTransportSecurity is null
                ? CreateBadge(renderContext, "off", TypeColorBackgroundBadge.Danger)
                : CreateCode([headers.StrictTransportSecurity], "webexpress.webapp:setting.security.hsts.httpsonly", renderContext));

            foreach (var header in headers.Headers.OrderBy(x => x.Key))
            {
                yield return CreateRow(header.Key, CreateCode([header.Value]));
            }
        }

        /// <summary>
        /// Creates the rows of the cookie attributes. The two fixed exceptions are listed because
        /// they do not follow the configured default and would otherwise look like a misconfiguration.
        /// </summary>
        /// <param name="renderContext">The context for rendering the page.</param>
        /// <param name="headers">The effective security headers.</param>
        /// <returns>The table rows.</returns>
        private static IEnumerable<IControlTableRow> CreateCookieRows(IRenderContext renderContext, SecurityHeaders headers)
        {
            yield return CreateRow(renderContext, "samesite", CreateCode([headers.CookieSameSite.ToString()]));
            yield return CreateRow(renderContext, "samesite.refresh", CreateCode(["Strict"]));
            yield return CreateRow(renderContext, "samesite.oidc", CreateCode(["Lax"]));
        }

        /// <summary>
        /// Creates the rows of the cross-site request check.
        /// </summary>
        /// <param name="renderContext">The context for rendering the page.</param>
        /// <param name="guard">The effective check.</param>
        /// <returns>The table rows.</returns>
        private static IEnumerable<IControlTableRow> CreateCsrfRows(IRenderContext renderContext, RequestOriginGuard guard)
        {
            yield return CreateRow(renderContext, "csrf.status", guard.Enabled
                ? CreateBadge(renderContext, "active", TypeColorBackgroundBadge.Success)
                : CreateBadge(renderContext, "off", TypeColorBackgroundBadge.Danger));

            var origins = guard.TrustedOrigins.ToList();

            yield return CreateRow(renderContext, "csrf.trustedorigins", origins.Count == 0
                ? CreateNote(renderContext, "webexpress.webapp:setting.security.none")
                : CreateCode(origins));
        }

        /// <summary>
        /// Creates the rows of the protocols, one per endpoint as the server actually opened it.
        /// </summary>
        /// <param name="renderContext">The context for rendering the page.</param>
        /// <returns>The table rows.</returns>
        private IEnumerable<IControlTableRow> CreateProtocolRows(IRenderContext renderContext)
        {
            yield return CreateRow(renderContext, "quic", HttpServer.QuicSupported
                ? CreateBadge(renderContext, "available", TypeColorBackgroundBadge.Success)
                : CreateBadge(renderContext, "unavailable", TypeColorBackgroundBadge.Warning));

            foreach (var endpoint in _server?.ListeningEndpoints ?? [])
            {
                yield return CreateRow
                (
                    $"{(endpoint.Tls ? "https" : "http")}://{endpoint.Endpoint}",
                    CreateCode([FormatProtocols(endpoint.Protocols)])
                );
            }
        }

        /// <summary>
        /// Adds a titled two-column table to the page.
        /// </summary>
        /// <param name="renderContext">The context for rendering the page.</param>
        /// <param name="panel">The panel receiving the section.</param>
        /// <param name="section">The key of the section title.</param>
        /// <param name="rows">The rows of the table.</param>
        private static void AddSection(IRenderContext renderContext, IControlWebAppMain panel, string section, IEnumerable<IControlTableRow> rows)
        {
            panel.AddPrimary(new ControlText
            {
                Text = _ => I18N.Translate(renderContext, $"webexpress.webapp:setting.security.group.{section}.label"),
                TextColor = _ => new PropertyColorText(TypeColorText.Info),
                Margin = _ => new PropertySpacingMargin(PropertySpacing.Space.Two)
            });

            var table = new ControlTable
            {
                Striped = _ => TypeStripedTable.Row,
                SuppressHeaders = _ => true
            }
                .AddColumn("")
                .AddColumn("");

            table.AddRows(rows);
            panel.AddPrimary(table);
        }

        /// <summary>
        /// Creates a row with a translated label.
        /// </summary>
        /// <param name="renderContext">The context for rendering the page.</param>
        /// <param name="key">The key of the label below <c>setting.security.item</c>.</param>
        /// <param name="value">The control showing the value.</param>
        /// <returns>The table row.</returns>
        private static IControlTableRow CreateRow(IRenderContext renderContext, string key, IControl value)
        {
            return CreateRow(I18N.Translate(renderContext, $"webexpress.webapp:setting.security.item.{key}"), value);
        }

        /// <summary>
        /// Creates a row with a literal label, such as a header name or an endpoint.
        /// </summary>
        /// <param name="label">The label, shown as text.</param>
        /// <param name="value">The control showing the value.</param>
        /// <returns>The table row.</returns>
        private static IControlTableRow CreateRow(string label, IControl value)
        {
            return new ControlTableRow().Add
            (
                new ControlTableCell { Text = _ => WebUtility.HtmlEncode(label) },
                new ControlTableCellPanel().Add(value)
            );
        }

        /// <summary>
        /// Shows configured values as code, one per line. The values come from the configuration
        /// file and are encoded, since a policy or origin must never turn into markup.
        /// </summary>
        /// <param name="lines">The values.</param>
        /// <param name="noteKey">An optional translation key of a remark appended to the last line.</param>
        /// <param name="renderContext">The context used to translate the remark.</param>
        /// <returns>The text control.</returns>
        private static ControlText CreateCode(IEnumerable<string> lines, string noteKey = null, IRenderContext renderContext = null)
        {
            var text = string.Join("<br/>", lines.Select(WebUtility.HtmlEncode));

            if (noteKey is not null)
            {
                text += " " + WebUtility.HtmlEncode(I18N.Translate(renderContext, noteKey));
            }

            return new ControlText
            {
                Text = _ => text,
                Format = _ => TypeFormatText.Code,
                Classes = ["text-break"]
            };
        }

        /// <summary>
        /// Shows an explanatory remark in place of a value.
        /// </summary>
        /// <param name="renderContext">The context for rendering the page.</param>
        /// <param name="key">The translation key of the remark.</param>
        /// <returns>The text control.</returns>
        private static ControlText CreateNote(IRenderContext renderContext, string key)
        {
            return new ControlText
            {
                Text = _ => I18N.Translate(renderContext, key),
                TextColor = _ => new PropertyColorText(TypeColorText.Secondary)
            };
        }

        /// <summary>
        /// Shows a state with text and color, so color is never the only carrier of the meaning.
        /// </summary>
        /// <param name="renderContext">The context for rendering the page.</param>
        /// <param name="state">The key of the state below <c>setting.security.state</c>.</param>
        /// <param name="color">The semantic color.</param>
        /// <returns>The badge.</returns>
        private static ControlBadge CreateBadge(IRenderContext renderContext, string state, TypeColorBackgroundBadge color)
        {
            return new ControlBadge
            {
                Value = _ => I18N.Translate(renderContext, $"webexpress.webapp:setting.security.state.{state}"),
                BackgroundColor = _ => new PropertyColorBackgroundBadge(color),
                Pill = _ => TypePillBadge.Pill
            };
        }

        /// <summary>
        /// Names the protocols the way administrators know them from browser tools.
        /// </summary>
        /// <param name="protocols">The protocols of an endpoint.</param>
        /// <returns>The protocol names, comma separated.</returns>
        private static string FormatProtocols(HttpProtocols protocols)
        {
            var names = new List<string>();

            if (protocols.HasFlag(HttpProtocols.Http1)) { names.Add("HTTP/1.1"); }
            if (protocols.HasFlag(HttpProtocols.Http2)) { names.Add("HTTP/2"); }
            if (protocols.HasFlag(HttpProtocols.Http3)) { names.Add("HTTP/3"); }

            return string.Join(", ", names);
        }
    }
}
