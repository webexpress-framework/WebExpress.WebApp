using System.Reflection;
using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WWW.Api.V1;
using WebExpress.WebCore.WebApplication;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebPackage.Model;
using WebExpress.WebCore.WebPlugin;
using WebExpress.WebCore.WebRestApi;

namespace WebExpress.WebApp.Test.WebRestApi
{
    /// <summary>
    /// Tests the plugin package REST API, which hands every change to the package manager.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestRestApiPluginPackage
    {
        /// <summary>
        /// A built-in plugin that is no system plugin can be removed through the API: it is
        /// withdrawn at once, and its file is recorded for deletion on the next start.
        /// </summary>
        [Fact]
        public void BuiltInPluginCanBeRemoved()
        {
            // arrange
            var hub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var package = hub.PackageManager.GetPackages().First(x => x.BuiltIn && !x.SystemPlugin);
            var api = new PluginPackage(hub, UnitTestControlFixture.CreateHttpServerContextMock(), null);
            var request = CreateRequest("DELETE", "/api/1/pluginpackage/item/" + Uri.EscapeDataString(package.Id));

            // the fixture has no package directory, so the catalog recording the file lands in
            // the working directory; it must not outlive the test, or a server started from here
            // would delete the test assembly
            var catalogFile = Path.GetFullPath("catalog.xml");
            var catalogExisted = File.Exists(catalogFile);

            try
            {
                // act
                var response = api.Delete(request);

                // validation
                Assert.IsType<ResponseOK>(response);
                Assert.Null(hub.PackageManager.GetPackage(package.Id));
                Assert.DoesNotContain(hub.PluginManager.Plugins, x => x.PluginId.ToString() == package.Id);
                Assert.Contains("<removed>", File.ReadAllText(catalogFile), StringComparison.Ordinal);
            }
            finally
            {
                if (!catalogExisted)
                {
                    File.Delete(catalogFile);
                }
            }
        }

        /// <summary>
        /// The plugin of the application the API is reached through cannot be removed through it.
        /// </summary>
        [Fact]
        public void PluginOfTheServingApplicationIsNotRemoved()
        {
            // arrange
            var hub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var package = hub.PackageManager.GetPackages().First(x => x.BuiltIn && !x.SystemPlugin);
            var api = new PluginPackage(hub, UnitTestControlFixture.CreateHttpServerContextMock(), CreateRestApiContext(package.Plugins.First()));
            var request = CreateRequest("DELETE", "/api/1/pluginpackage/item/" + Uri.EscapeDataString(package.Id));

            // act
            var response = api.Delete(request);

            // validation
            Assert.IsType<ResponseBadRequest>(response);
            Assert.Equal(PackageCatalogItemState.Active, hub.PackageManager.GetPackage(package.Id)?.State);
        }

        /// <summary>
        /// A built-in plugin that is no system plugin can be switched off and on again through
        /// the API.
        /// </summary>
        [Fact]
        public void BuiltInPluginCanBeSwitched()
        {
            // arrange
            var hub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var package = hub.PackageManager.GetPackages().First(x => x.BuiltIn && !x.SystemPlugin);
            var api = new PluginPackage(hub, UnitTestControlFixture.CreateHttpServerContextMock(), null);
            var path = "/api/1/pluginpackage/action/{0}/" + Uri.EscapeDataString(package.Id);

            // the fixture has no package directory, so the catalog recording the state lands in
            // the working directory
            var catalogFile = Path.GetFullPath("catalog.xml");
            var catalogExisted = File.Exists(catalogFile);

            try
            {
                // act + validation
                Assert.IsType<ResponseOK>(api.Update(CreateRequest("PUT", string.Format(path, "deactivate"))));
                Assert.Equal(PackageCatalogItemState.Disable, hub.PackageManager.GetPackage(package.Id)?.State);
                Assert.IsType<ResponseOK>(api.Update(CreateRequest("PUT", string.Format(path, "activate"))));
                Assert.Equal(PackageCatalogItemState.Active, hub.PackageManager.GetPackage(package.Id)?.State);
            }
            finally
            {
                hub.PackageManager.ActivatePackage(package.Id);

                if (!catalogExisted)
                {
                    File.Delete(catalogFile);
                }
            }
        }

        /// <summary>
        /// The plugin of the application the API is reached through cannot be deactivated
        /// through it: nothing would be left to activate it again with.
        /// </summary>
        [Fact]
        public void PluginOfTheServingApplicationIsNotDeactivated()
        {
            // arrange
            var hub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var package = hub.PackageManager.GetPackages().First(x => x.BuiltIn && !x.SystemPlugin);
            var api = new PluginPackage(hub, UnitTestControlFixture.CreateHttpServerContextMock(), CreateRestApiContext(package.Plugins.First()));
            var request = CreateRequest("PUT", "/api/1/pluginpackage/action/deactivate/" + Uri.EscapeDataString(package.Id));

            // act
            var response = api.Update(request);

            // validation
            Assert.IsType<ResponseBadRequest>(response);
            Assert.Equal(PackageCatalogItemState.Active, hub.PackageManager.GetPackage(package.Id)?.State);
        }

        /// <summary>
        /// An unknown package is answered with the package manager's message rather than a
        /// failure of the API's own.
        /// </summary>
        [Fact]
        public void UnknownPackageIsReportedAsNotFound()
        {
            // arrange
            var hub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new PluginPackage(hub, UnitTestControlFixture.CreateHttpServerContextMock(), null);
            var request = CreateRequest("DELETE", "/api/1/pluginpackage/item/unknown.package");

            // act
            var response = api.Delete(request);

            // validation
            Assert.IsType<ResponseBadRequest>(response);
            Assert.Contains("unknown.package", response.Content?.ToString(), StringComparison.Ordinal);
            Assert.Contains("not found", response.Content?.ToString(), StringComparison.Ordinal);
        }

        /// <summary>
        /// An update without a package file is refused before the package manager is asked.
        /// </summary>
        [Fact]
        public void UpdateWithoutFileIsRefused()
        {
            // arrange
            var hub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new PluginPackage(hub, UnitTestControlFixture.CreateHttpServerContextMock(), null);
            var request = CreateRequest("PUT", "/api/1/pluginpackage/action/update/some.package");

            // act
            var response = api.Update(request);

            // validation
            Assert.IsType<ResponseBadRequest>(response);
        }

        /// <summary>
        /// Creates the context of the API as reached through the application of a plugin.
        /// </summary>
        /// <param name="pluginContext">The plugin owning the application.</param>
        /// <returns>The API context.</returns>
        private static IRestApiContext CreateRestApiContext(IPluginContext pluginContext)
        {
            var flags = BindingFlags.Instance | BindingFlags.NonPublic | BindingFlags.Public;
            var applicationContext = new ApplicationContext();
            typeof(ApplicationContext).GetProperty(nameof(ApplicationContext.PluginContext), flags).SetValue(applicationContext, pluginContext);

            var restApiContext = new RestApiContext();
            typeof(RestApiContext).GetProperty(nameof(RestApiContext.ApplicationContext), flags).SetValue(restApiContext, applicationContext);

            return restApiContext;
        }

        /// <summary>
        /// Creates a request with the given method and uri.
        /// </summary>
        /// <param name="method">The request method.</param>
        /// <param name="uri">The request uri.</param>
        /// <returns>The request.</returns>
        private static Request CreateRequest(string method, string uri)
        {
            var content = $@"{method} {uri} HTTP/1.1
                Host: localhost
                Content-Type: text/html";

            return UnitTestControlFixture.CreateHttpContextMock(content).Request as Request;
        }
    }
}
