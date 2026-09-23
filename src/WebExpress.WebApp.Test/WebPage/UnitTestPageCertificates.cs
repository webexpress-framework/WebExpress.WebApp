using Microsoft.Extensions.Configuration;
using System.Net;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebApp.WebSettingPage;
using WebExpress.WebApp.WWW.Settings.System;
using WebExpress.WebCore.WebCertificate;
using WebExpress.WebCore.WebComponent;
using WebExpress.WebCore.WebIdentity;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebPolicies;
using WebExpress.WebCore.WebSetting;
using WebExpress.WebCore.WebSettingPage;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebPage
{
    /// <summary>
    /// Exercises the certificate overview with real manager validation and registered administrative routing.
    /// </summary>
    [Collection("NonParallelTests")]
    public sealed class UnitTestPageCertificates
    {
        /// <summary>
        /// Keeps HTTP development usable without requiring a certificate inventory in either supported language.
        /// </summary>
        /// <param name="language">The request language used by the standard settings controls.</param>
        /// <param name="emptyTitle">The translated empty-state heading expected by administrators.</param>
        /// <param name="emptyMessage">The translated explanation that development does not require certificates.</param>
        [Theory]
        [InlineData("en", "No certificates loaded", "HTTP development does not require a certificate.")]
        [InlineData("de", "Keine Zertifikate geladen", "Für die Entwicklung mit HTTP ist kein Zertifikat erforderlich.")]
        public void EmptyInventoryExplainsHttpDevelopment(string language, string emptyTitle, string emptyMessage)
        {
            // arrange
            using var fixture = new CertificatePageFixture();

            // act
            var html = fixture.Render(language);

            // validation
            Assert.Contains(emptyTitle, html);
            Assert.Contains(emptyMessage, html);
            Assert.DoesNotContain("wx-certificates", html);
            Assert.DoesNotContain("setting.certificate.", html);
        }

        /// <summary>
        /// Shows operational failures before healthy entries while retaining metadata and translated summaries.
        /// </summary>
        /// <param name="language">The request language used to format labels and UTC dates.</param>
        /// <param name="total">The expected translated inventory count.</param>
        /// <param name="usable">The expected translated count of certificates usable for HTTPS.</param>
        /// <param name="expiring">The expected translated warning count.</param>
        /// <param name="unusable">The expected translated failure count.</param>
        [Theory]
        [InlineData("en", "Configured: 4", "Usable: 2", "Expiring soon: 1", "Unusable: 2")]
        [InlineData("de", "Konfiguriert: 4", "Verwendbar: 2", "Bald ablaufend: 1", "Nicht verwendbar: 2")]
        public void MixedInventoryDisplaysMetadataAndPrioritizesFailures(string language, string total, string usable, string expiring, string unusable)
        {
            // arrange
            using var fixture = new CertificatePageFixture();
            fixture.Load("healthy", "soon", "expired", "failed");
            var healthy = fixture.Hub.CertificateManager.GetCertificates().Single(x => x.Alias == "healthy");

            // act
            var html = fixture.Render(language);

            // validation
            Assert.Contains(total, html);
            Assert.Contains(usable, html);
            Assert.Contains(expiring, html);
            Assert.Contains(unusable, html);
            Assert.Contains("healthy.example.test", html);
            Assert.Contains(WebUtility.HtmlEncode(healthy.Issuer), html);
            Assert.Contains(healthy.Thumbprint, html);
            Assert.Contains(" UTC", html);
            Assert.Contains("memory", html);
            Assert.True(html.IndexOf(">failed<", StringComparison.Ordinal) < html.IndexOf(">expired<", StringComparison.Ordinal));
            Assert.True(html.IndexOf(">expired<", StringComparison.Ordinal) < html.IndexOf(">soon<", StringComparison.Ordinal));
            Assert.True(html.IndexOf(">soon<", StringComparison.Ordinal) < html.IndexOf(">healthy<", StringComparison.Ordinal));
            Assert.DoesNotContain("secret-password", html);
            Assert.DoesNotContain("private-location", html);
            Assert.DoesNotContain("setting.certificate.", html);
        }

        /// <summary>
        /// Gives administrators text for every validation flag, including multiple failures on the same certificate.
        /// </summary>
        /// <param name="scenario">The material condition evaluated by the real certificate manager.</param>
        /// <param name="labels">The status labels that must remain visible independently of badge color.</param>
        [Theory]
        [InlineData("healthy", new[] { "Valid" })]
        [InlineData("soon", new[] { "Expiring soon" })]
        [InlineData("expired", new[] { "Expired" })]
        [InlineData("future", new[] { "Not yet valid" })]
        [InlineData("keyless", new[] { "Private key missing" })]
        [InlineData("client", new[] { "Not suitable for server authentication" })]
        [InlineData("mismatch", new[] { "Hostname not covered" })]
        [InlineData("failed", new[] { "Could not be loaded", "Not available" })]
        [InlineData("combined", new[] { "Expired", "Private key missing", "Hostname not covered" })]
        public void ValidationFlagsRemainVisible(string scenario, string[] labels)
        {
            // arrange
            using var fixture = new CertificatePageFixture();
            fixture.Load(scenario);

            // act
            var html = fixture.Render();

            // validation
            foreach (var label in labels)
            {
                Assert.Contains(">" + label + "<", html);
            }
        }

        /// <summary>
        /// Prevents external certificate names from injecting markup into the administrative page.
        /// </summary>
        /// <param name="alias">The alias that must be displayed literally without markup or translation.</param>
        [Theory]
        [InlineData("<img src=x onerror=alert(1)>")]
        [InlineData("webexpress.webapp:setting.title.certificate.label")]
        public void CertificateMetadataIsEncodedAndCredentialsAreAbsent(string alias)
        {
            // arrange
            using var fixture = new CertificatePageFixture();
            fixture.Store.Subject = "CN=\"<script>alert(1)</script>\"";
            fixture.Load(alias);

            // act
            var html = fixture.Render();

            // validation
            Assert.Contains(WebUtility.HtmlEncode(alias), html);
            Assert.Contains("&lt;script&gt;alert(1)&lt;/script&gt;", html);
            Assert.DoesNotContain("<img src=x onerror=alert(1)>", html);
            Assert.DoesNotContain("<script>alert(1)</script>", html);
            Assert.DoesNotContain("secret-password", html);
            Assert.DoesNotContain("private-location", html);
        }

        /// <summary>
        /// Obtains new metadata on each request without implicitly loading or changing certificate storage.
        /// </summary>
        [Fact]
        public void ReloadedInventoryIsVisibleWithoutPageTriggeredStoreAccess()
        {
            // arrange
            using var fixture = new CertificatePageFixture();
            fixture.Load("healthy");
            Assert.Contains(">healthy<", fixture.Render());
            Assert.Equal(1, fixture.Store.LoadCount);

            // act
            fixture.Load("soon");
            var html = fixture.Render();

            // validation
            Assert.Contains(">soon<", html);
            Assert.DoesNotContain(">healthy<", html);
            Assert.Equal(2, fixture.Store.LoadCount);
        }

        /// <summary>
        /// Offers the settings entries only to identities holding system access, both in the settings
        /// sidebar and in the settings menu of the app header, matching the check at the endpoint.
        /// </summary>
        /// <param name="authenticated">Whether a real signed login supplies the request identity.</param>
        /// <param name="administrator">Whether the login grants the existing system access policy.</param>
        [Theory]
        [InlineData(false, false)]
        [InlineData(true, false)]
        [InlineData(true, true)]
        public void MenuShowsEntryOnlyWithSystemAccess(bool authenticated, bool administrator)
        {
            // arrange
            using var fixture = new CertificatePageFixture();
            var context = fixture.CreateContext("en");
            if (authenticated)
            {
                fixture.Hub.IdentityManager.Login(new Identity(Guid.NewGuid(), "test-user",
                    policyNames: administrator ? [typeof(SystemAccessPolicy).FullName] : []), context.Request);
            }
            var identity = fixture.Hub.IdentityManager.GetCurrentIdentity(context.Request);
            var tree = new VisualTreeWebAppSetting(fixture.Hub, fixture.PageContext);

            // act
            var menu = new ControlWebAppSettingMenu().Render(context, tree)?.ToString() ?? "";
            var header = new ControlWebAppHeaderSettings().Render(context, tree)?.ToString() ?? "";

            // validation
            Assert.IsType<SystemAccessPolicy>(Assert.Single(fixture.PageContext.Policies));
            Assert.False(fixture.PageContext.Cache);
            Assert.Equal(administrator, fixture.Hub.IdentityManager.CheckAccess(identity, fixture.PageContext));
            Assert.Equal(administrator, menu.Contains("data-label=\"Certificates\""));
            Assert.Equal(administrator, menu.Contains("data-uri=\"" + fixture.PageContext.Route.ToUri() + "\""));
            Assert.Equal(administrator, header.Contains(">System</div>"));
        }

        /// <summary>
        /// Guards every shipped settings page, so no system diagnostic stays reachable for accounts
        /// without system access after the menu entries are hidden from them.
        /// </summary>
        [Fact]
        public void EverySettingPageRequiresSystemAccess()
        {
            // arrange
            using var fixture = new CertificatePageFixture();
            var pages = fixture.Hub.SettingPageManager
                .GetSettingPages(fixture.PageContext.ApplicationContext, fixture.PageContext.SettingCategory)
                .ToList();

            // validation
            Assert.NotEmpty(pages);
            Assert.All(pages, page => Assert.Contains(page.Policies, policy => policy is SystemAccessPolicy));
        }

        /// <summary>
        /// Provides real plugin registration and isolated authentication state without reading certificate files.
        /// </summary>
        private sealed class CertificatePageFixture : IDisposable
        {
            private readonly DirectoryInfo _tokenDirectory = Directory.CreateTempSubdirectory("wx-certificate-page-tests-");

            internal ComponentHub Hub { get; }
            internal ISettingPageContext PageContext { get; }
            internal MemoryCertificateStore Store { get; } = new();

            /// <summary>
            /// Registers the shipped settings page and an in-memory certificate provider for repeatable diagnostics.
            /// </summary>
            internal CertificatePageFixture()
            {
                var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string>
                {
                    ["WebExpress:Authentication:Issuer"] = "https://certificate-page.test",
                    ["WebExpress:Authentication:Audience"] = "certificate-page-tests",
                    ["WebExpress:Authentication:SigningKey"] = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)),
                    ["WebExpress:Authentication:TokenStorePath"] = _tokenDirectory.FullName,
                    ["WebExpress:Authentication:RequireHttps"] = "false"
                }).Build();
                Hub = UnitTestControlFixture.CreateAndRegisterComponentHubMock(configuration);
                var application = Hub.ApplicationManager.GetApplications(typeof(TestApplication)).Single();
                PageContext = Assert.Single(Hub.SettingPageManager.GetSettingPages(typeof(Certificates), application));
                Hub.CertificateManager.RegisterStore(Store);
            }

            /// <summary>
            /// Exercises the production manager path so status badges reflect actual validation outcomes.
            /// </summary>
            /// <param name="aliases">The test scenarios and stable aliases included in this inventory.</param>
            internal void Load(params string[] aliases)
            {
                Hub.CertificateManager.Load(new HttpServerSettings
                {
                    Certificates = new CertificateManagerSettings
                    {
                        WarningThresholdDays = [30, 14, 7],
                        Items = aliases.Select(alias => new CertificateSettings
                        {
                            Alias = alias,
                            Store = Store.Name,
                            HostNames = [alias.StartsWith('<') || alias.Contains(':') ? "metadata.example.test" : alias + ".example.test"],
                            Reference = "private-location/" + alias,
                            Password = "secret-password"
                        }).ToList()
                    }
                });
            }

            /// <summary>
            /// Binds the registered application to a request with an explicit language for deterministic localization.
            /// </summary>
            /// <param name="language">The Accept-Language value used for certificate labels and dates.</param>
            /// <returns>The control rendering context for the registered settings page.</returns>
            internal RenderControlContext CreateContext(string language)
            {
                var request = UnitTestControlFixture.CreateRequestMock($"GET / HTTP/1.1\r\nAccept-Language: {language}\r\n\r\n");
                typeof(RequestBase).GetProperty(nameof(RequestBase.ApplicationContext)).SetValue(request, PageContext.ApplicationContext);
                return new RenderControlContext(null, PageContext, request);
            }

            /// <summary>
            /// Renders the shipped controls into HTML so encoding and translations are tested at the output boundary.
            /// </summary>
            /// <param name="language">The language selected for this page request.</param>
            /// <returns>The HTML fragment containing all certificate page content.</returns>
            internal string Render(string language = "en")
            {
                var context = CreateContext(language);
                var tree = new VisualTreeWebAppSetting(Hub, PageContext);
                new Certificates(Hub).Process(context, tree);
                return tree.Content.MainPanel.Render(context, tree).ToString();
            }

            /// <summary>
            /// Releases the generated keys and deletes only the temporary authentication directory owned by this fixture.
            /// </summary>
            public void Dispose()
            {
                Hub.CertificateManager.Dispose();
                Hub.IdentityProviderManager.Dispose();
                _tokenDirectory.Delete(true);
                Hub.Dispose();
            }
        }

        /// <summary>
        /// Produces isolated certificate material without coupling the page tests to filesystem or operating-system key stores.
        /// </summary>
        private sealed class MemoryCertificateStore : ICertificateStore
        {
            /// <summary>
            /// Gets the provider name used to register this isolated test store.
            /// </summary>
            public string Name => "memory";

            internal int LoadCount { get; private set; }
            internal string Subject { get; set; } = "CN=Certificate page tests";

            /// <summary>
            /// Generates real X.509 material with the requested validation failure for the manager to inspect.
            /// </summary>
            /// <param name="reference">The private reference containing the selected test scenario.</param>
            /// <param name="password">The credential that must never appear in page output.</param>
            /// <returns>New material owned by the certificate manager after validation.</returns>
            public CertificateMaterial Load(string reference, string password)
            {
                LoadCount++;
                var scenario = reference["private-location/".Length..];
                if (scenario == "failed") { throw new InvalidOperationException(password + reference); }

                using var key = ECDsa.Create(ECCurve.NamedCurves.nistP256);
                var request = new CertificateRequest(Subject, key, HashAlgorithmName.SHA256);
                var names = new SubjectAlternativeNameBuilder();
                names.AddDnsName(scenario is "mismatch" or "combined" ? "different.example.test" :
                    scenario.StartsWith('<') || scenario.Contains(':') ? "metadata.example.test" : scenario + ".example.test");
                request.CertificateExtensions.Add(names.Build());
                request.CertificateExtensions.Add(new X509EnhancedKeyUsageExtension(
                    new OidCollection { new Oid(scenario == "client" ? "1.3.6.1.5.5.7.3.2" : "1.3.6.1.5.5.7.3.1") }, false));
                var now = DateTimeOffset.UtcNow;
                var start = now.AddDays(scenario == "future" ? 1 : -90);
                var end = now.AddDays(scenario is "expired" or "combined" ? -1 : scenario == "soon" ? 5 : 90);
                var certificate = request.CreateSelfSigned(start, end);
                if (scenario is "keyless" or "combined")
                {
                    var publicCertificate = X509CertificateLoader.LoadCertificate(certificate.Export(X509ContentType.Cert));
                    certificate.Dispose();
                    certificate = publicCertificate;
                }
                return new CertificateMaterial(certificate);
            }
        }
    }
}
