using Microsoft.Extensions.Configuration;
using System.Net;
using System.Security.Cryptography;
using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebApp.WebSettingPage;
using WebExpress.WebApp.WWW.Settings.System;
using WebExpress.WebCore.WebComponent;
using WebExpress.WebCore.WebIdentity;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebPolicies;
using WebExpress.WebCore.WebSettingPage;
using WebExpress.WebCore.WebSitemap;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebPage
{
    /// <summary>
    /// Verifies email diagnostics, credential redaction and activation-aware settings navigation.
    /// </summary>
    [Collection("NonParallelTests")]
    public sealed class UnitTestPageEmail
    {
        /// <summary>
        /// Requires both activated email and system access for the sidebar entry and its route.
        /// </summary>
        /// <param name="enabled">Whether the deployment activates email.</param>
        /// <param name="authenticated">Whether the request has a signed identity.</param>
        /// <param name="administrator">Whether that identity holds system access.</param>
        [Theory]
        [InlineData(null, true, true)]
        [InlineData(false, true, true)]
        [InlineData(true, false, false)]
        [InlineData(true, true, false)]
        [InlineData(true, true, true)]
        public void VisibilityRequiresActivationAndSystemAccess(bool? enabled, bool authenticated, bool administrator)
        {
            // arrange
            using var fixture = new EmailPageFixture(enabled);
            var context = fixture.CreateContext("en");
            if (authenticated)
            {
                fixture.Hub.IdentityManager.Login(new Identity(Guid.NewGuid(), "reader",
                    policyNames: administrator ? [typeof(SystemAccessPolicy).FullName] : []), context.Request);
            }
            var tree = new VisualTreeWebAppSetting(fixture.Hub, fixture.PageContext);
            fixture.Hub.SitemapManager.Refresh();

            // act
            var menu = new ControlWebAppSettingMenu().Render(context, tree)?.ToString() ?? "";
            var route = fixture.Hub.SitemapManager.SearchResource(
                new Uri("http://localhost" + fixture.PageContext.Route.ToUri()), new SearchContext());
            var identity = fixture.Hub.IdentityManager.GetCurrentIdentity(context.Request);

            // validation
            Assert.Equal(enabled == true && administrator, menu.Contains("data-label=\"Email\""));
            Assert.Equal(enabled == true && administrator, menu.Contains("data-uri=\"" + fixture.PageContext.Route.ToUri() + "\""));
            Assert.Equal(enabled == true, route is not null);
            Assert.Equal(administrator, fixture.Hub.IdentityManager.CheckAccess(identity, fixture.PageContext));
            Assert.False(fixture.PageContext.Cache);
            Assert.IsType<SystemAccessPolicy>(Assert.Single(fixture.PageContext.Policies));
        }

        /// <summary>
        /// Uses the manager's bound settings instead of configuration changes that are not active yet.
        /// </summary>
        /// <param name="language">The requested page language.</param>
        /// <param name="label">The expected translated status label.</param>
        [Theory]
        [InlineData("en", "Provider registered")]
        [InlineData("de", "Provider registriert")]
        public void ActiveSettingsAreLocalizedAndSecretsAreAbsent(string language, string label)
        {
            // arrange
            using var fixture = new EmailPageFixture(true, new()
            {
                ["WebExpress:Email:Profiles:default:Provider"] = "smtp",
                ["WebExpress:Email:Profiles:default:From"] = "sender@example.org",
                ["WebExpress:Email:Profiles:default:Host"] = "smtp.example.org",
                ["WebExpress:Email:Profiles:default:UserName"] = "private-account",
                ["WebExpress:Email:Profiles:default:Password"] = "secret-password",
                ["WebExpress:Email:Profiles:default:Options:apiKey"] = "secret-api-key"
            });
            fixture.Configuration["WebExpress:Email:Profiles:default:Host"] = "inactive.example.org";
            fixture.Configuration["WebExpress:Email:Enabled"] = "false";

            // act
            var html = fixture.Render(language);
            var status = fixture.Hub.EmailManager.GetStatus();

            // validation
            Assert.Contains("smtp.example.org:587", html);
            Assert.Contains("StartTls", html);
            Assert.Contains(label, html);
            Assert.Contains("26214400", html);
            Assert.DoesNotContain("inactive.example.org", html);
            Assert.DoesNotContain("private-account", html);
            Assert.DoesNotContain("secret-password", html);
            Assert.DoesNotContain("secret-api-key", html);
            Assert.DoesNotContain("setting.email.", html);
            Assert.True(status.Enabled);
            Assert.True(Assert.Single(status.Profiles).AuthenticationConfigured);
        }

        /// <summary>
        /// Keeps an enabled installation discoverable even before an administrator configures its first profile.
        /// </summary>
        /// <param name="language">The requested page language.</param>
        /// <param name="title">The translated empty-state heading.</param>
        [Theory]
        [InlineData("en", "No email profiles configured")]
        [InlineData("de", "Keine E-Mail-Profile konfiguriert")]
        public void EnabledWithoutProfilesShowsEmptyState(string language, string title)
        {
            // arrange
            using var fixture = new EmailPageFixture(true);

            // act
            var html = fixture.Render(language);

            // validation
            Assert.Contains(title, html);
            Assert.Contains("wx-email-policy", html);
            Assert.DoesNotContain("wx-email-profiles", html);
            Assert.DoesNotContain("setting.email.", html);
        }

        /// <summary>
        /// Rejects markup and translation-key interpretation in provider-controlled diagnostic strings.
        /// </summary>
        [Fact]
        public void ProfileMetadataIsLiteralAndMissingProvidersAreVisible()
        {
            // arrange
            const string provider = "<img src=x onerror=alert(1)>";
            using var fixture = new EmailPageFixture(true, new()
            {
                ["WebExpress:Email:Profiles:default:Provider"] = provider,
                ["WebExpress:Email:Profiles:default:From"] = "webexpress.webapp:setting.title.email.label"
            });

            // act
            var html = fixture.Render("en");

            // validation
            Assert.Contains(WebUtility.HtmlEncode(provider), html);
            Assert.DoesNotContain(provider, html);
            Assert.Contains("webexpress.webapp:setting.title.email.label", html);
            Assert.Contains("Provider unavailable", html);
            Assert.Contains("Not applicable", html);
        }

        /// <summary>
        /// Exercises the real registration pipeline and isolated authentication configuration.
        /// </summary>
        private sealed class EmailPageFixture : IDisposable
        {
            private readonly DirectoryInfo _tokens = Directory.CreateTempSubdirectory("wx-email-page-");

            /// <summary>Gets the configuration whose values are bound at manager construction.</summary>
            internal IConfigurationRoot Configuration { get; }

            /// <summary>Gets the registered component hub owned by this fixture.</summary>
            internal ComponentHub Hub { get; }

            /// <summary>Gets the email page discovered through normal plugin registration.</summary>
            internal ISettingPageContext PageContext { get; }

            /// <summary>Registers the production email page with isolated delivery and authentication settings.</summary>
            /// <param name="enabled">The activation flag, or null to omit email configuration.</param>
            /// <param name="settings">The optional profile settings.</param>
            internal EmailPageFixture(bool? enabled, Dictionary<string, string> settings = null)
            {
                var values = settings ?? [];
                if (enabled.HasValue)
                {
                    values["WebExpress:Email:Enabled"] = enabled.Value.ToString();
                }
                values["WebExpress:Authentication:Issuer"] = "https://email-page.test";
                values["WebExpress:Authentication:Audience"] = "email-page";
                values["WebExpress:Authentication:SigningKey"] = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
                values["WebExpress:Authentication:TokenStorePath"] = _tokens.FullName;
                values["WebExpress:Authentication:RequireHttps"] = "false";
                Configuration = new ConfigurationBuilder().AddInMemoryCollection(values).Build();
                Hub = UnitTestControlFixture.CreateAndRegisterComponentHubMock(Configuration);
                var application = Hub.ApplicationManager.GetApplications(typeof(TestApplication)).Single();
                PageContext = Assert.Single(Hub.SettingPageManager.GetSettingPages(typeof(Email), application));
            }

            /// <summary>Binds a request to the registered application and the selected language.</summary>
            /// <param name="language">The requested interface language.</param>
            /// <returns>The rendering context used by production controls.</returns>
            internal RenderControlContext CreateContext(string language)
            {
                var request = UnitTestControlFixture.CreateRequestMock($"GET / HTTP/1.1\r\nAccept-Language: {language}\r\n\r\n");
                typeof(RequestBase).GetProperty(nameof(RequestBase.ApplicationContext)).SetValue(request, PageContext.ApplicationContext);
                return new RenderControlContext(null, PageContext, request);
            }

            /// <summary>Renders the shipped page through its standard settings shell.</summary>
            /// <param name="language">The requested interface language.</param>
            /// <returns>The resulting page content markup.</returns>
            internal string Render(string language)
            {
                var context = CreateContext(language);
                var tree = new VisualTreeWebAppSetting(Hub, PageContext);
                new Email(Hub).Process(context, tree);
                return tree.Content.MainPanel.Render(context, tree).ToString();
            }

            /// <summary>Releases fixture resources before removing its isolated authentication directory.</summary>
            public void Dispose()
            {
                Hub.Dispose();
                _tokens.Delete(true);
                (Configuration as IDisposable)?.Dispose();
            }
        }
    }
}
