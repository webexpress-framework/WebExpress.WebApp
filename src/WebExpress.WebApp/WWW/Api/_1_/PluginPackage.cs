using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using WebExpress.WebApp.WebScope;
using WebExpress.WebCore;
using WebExpress.WebCore.WebApplication;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebComponent;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebPackage;
using WebExpress.WebCore.WebPackage.Model;
using WebExpress.WebCore.WebParameter;
using WebExpress.WebCore.WebPolicies;
using WebExpress.WebCore.WebRestApi;
using WebExpress.WebCore.WebStatusPage;

namespace WebExpress.WebApp.WWW.Api.V1
{
    /// <summary>
    /// REST API for plugin package management.
    /// </summary>
    /// <remarks>
    /// Every change goes through the public operations of the package manager. They hold the
    /// lock the periodic scan holds, coordinate the instances of a cluster, check dependencies
    /// in both directions and roll back what does not start - none of which a caller can
    /// reproduce from outside without racing the scan.
    /// </remarks>
    [IncludeSubPaths(true)]
    [Scope<IScopeAdmin>]
    [Policy<SystemAccessPolicy>]
    public sealed class PluginPackage : IRestApi
    {
        /// <summary>
        /// The largest package an upload may carry.
        /// </summary>
        internal const long MaxPackageSizeBytes = 100 * 1024 * 1024;

        /// <summary>
        /// The query parameter that asks the uninstallation to delete the shipped settings files too.
        /// </summary>
        internal const string RemoveSettingsParameter = "settings";

        private readonly IComponentHub _componentHub;
        private readonly IHttpServerContext _httpServerContext;
        private readonly IRestApiContext _restApiContext;

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="componentHub">The component hub.</param>
        /// <param name="httpServerContext">The reference to the context of the host.</param>
        /// <param name="restApiContext">The context of the API, which names the application it serves.</param>
        public PluginPackage(IComponentHub componentHub, IHttpServerContext httpServerContext, IRestApiContext restApiContext)
        {
            _componentHub = componentHub;
            _httpServerContext = httpServerContext;
            _restApiContext = restApiContext;
        }

        /// <summary>
        /// Retrieves package information.
        /// </summary>
        /// <param name="request">The request.</param>
        /// <returns>The response.</returns>
        [Method(RequestMethod.GET)]
        public Response Retrieve(Request request)
        {
            var packageManager = _componentHub?.PackageManager;

            // GetPackages, not Catalog.Packages: the catalog only knows what was installed from a
            // *.wxp file, and in a build deployment every plugin is referenced statically
            var packages = packageManager?.GetPackages()
                .OrderBy(x => x.Id)
                .Select(x => new
                {
                    id = x.Id,
                    file = x.File,
                    state = x.State.ToString(),
                    builtIn = x.BuiltIn,
                    systemPlugin = x.SystemPlugin,
                    required = IsRequiredByManagement(packageManager, x, _restApiContext?.ApplicationContext),
                    problem = x.GetProblem(request.Culture),
                    version = x.Metadata?.Version,
                    title = x.Metadata?.Title,
                    description = x.Metadata?.Description,
                    authors = x.Metadata?.Authors,
                    pluginSources = x.Metadata?.PluginSources?.ToArray() ?? [],
                    dependencies = x.Metadata?.Dependencies?.ToArray() ?? [],
                    dependents = packageManager.GetDependentPackages(x.Id).Select(d => d.Id).ToArray(),
                    settings = x.Metadata?.Settings?.ToArray() ?? [],
                    plugins = x.Plugins.Select(p => new
                    {
                        id = p.PluginId?.ToString(),
                        name = p.PluginName,
                        version = p.Version
                    }).ToArray()
                });

            return CreateJsonResponse(new
            {
                success = true,
                packages
            });
        }

        /// <summary>
        /// Installs a package from upload.
        /// </summary>
        /// <param name="request">The request.</param>
        /// <returns>The response.</returns>
        [Method(RequestMethod.POST)]
        public Response Create(Request request)
        {
            var file = request.Parameters.OfType<ParameterFile>().FirstOrDefault();
            if (file?.Data is null || file.Data.Length == 0)
            {
                return CreateErrorResponse(I18N.Translate(request, "webexpress.webapp:setting.plugin.operation.error.empty"));
            }

            return Run(request, packageManager =>
            {
                using var stream = new MemoryStream(file.Data);

                return packageManager.UploadPackage(stream, file.Value, true, MaxPackageSizeBytes);
            });
        }

        /// <summary>
        /// Updates package status or package content.
        /// </summary>
        /// <param name="request">The request.</param>
        /// <returns>The response.</returns>
        [Method(RequestMethod.PUT)]
        [Method(RequestMethod.PATCH)]
        public Response Update(Request request)
        {
            var (packageId, action) = ResolveActionPath(request);
            if (string.IsNullOrWhiteSpace(packageId) || string.IsNullOrWhiteSpace(action))
            {
                return CreateErrorResponse(I18N.Translate(request, "webexpress.webapp:setting.plugin.operation.error.request"));
            }

            var file = request.Parameters.OfType<ParameterFile>().FirstOrDefault();
            if (action == "update" && (file?.Data is null || file.Data.Length == 0))
            {
                return CreateErrorResponse(I18N.Translate(request, "webexpress.webapp:setting.plugin.operation.error.empty"));
            }

            // the manager cannot tell which application a request came through; switching off
            // the one serving this API would take away the way to switch it on again
            // a system plugin is refused by the manager itself, with the more precise reason
            var packageManager = _componentHub?.PackageManager;
            var package = packageManager?.GetPackage(packageId);
            if (action == "deactivate" && package is { SystemPlugin: false } && IsRequiredByManagement(packageManager, package, _restApiContext?.ApplicationContext))
            {
                return CreateErrorResponse(I18N.Translate(request, "webexpress.webapp:setting.plugin.operation.error.required", packageId));
            }

            return Run(request, packageManager =>
            {
                switch (action)
                {
                    case "activate":
                        return packageManager.ActivatePackage(packageId);
                    case "deactivate":
                        return packageManager.DeactivatePackage(packageId);
                    default:
                        using (var stream = new MemoryStream(file.Data))
                        {
                            return packageManager.UpdatePackage(packageId, stream, file.Value, true, MaxPackageSizeBytes);
                        }
                }
            });
        }

        /// <summary>
        /// Deletes an installed package.
        /// </summary>
        /// <param name="request">The request.</param>
        /// <returns>The response.</returns>
        [Method(RequestMethod.DELETE)]
        public Response Delete(Request request)
        {
            var packageId = ResolveItemPath(request);
            if (string.IsNullOrWhiteSpace(packageId))
            {
                return CreateErrorResponse(I18N.Translate(request, "webexpress.webapp:setting.plugin.operation.error.request"));
            }

            // removing the plugin serving this API would take the management away for good
            var packageManager = _componentHub?.PackageManager;
            var package = packageManager?.GetPackage(packageId);
            if (package is { SystemPlugin: false } && IsRequiredByManagement(packageManager, package, _restApiContext?.ApplicationContext))
            {
                return CreateErrorResponse(I18N.Translate(request, "webexpress.webapp:setting.plugin.operation.error.required", packageId));
            }

            var removeSettings = string.Equals(request.GetParameter(RemoveSettingsParameter)?.Value, "true", StringComparison.OrdinalIgnoreCase);

            return Run(request, packageManager => packageManager.UninstallPackage(packageId, removeSettings));
        }

        /// <summary>
        /// Runs a package operation and turns its result into the response.
        /// </summary>
        /// <param name="request">The request.</param>
        /// <param name="operation">The operation.</param>
        /// <returns>The response.</returns>
        private Response Run(Request request, Func<IPackageManager, PackageOperationResult> operation)
        {
            var packageManager = _componentHub?.PackageManager;
            PackageOperationResult result;

            try
            {
                result = packageManager is not null ? operation(packageManager) : null;
            }
            catch (Exception ex)
            {
                // the manager answers expected failures with a result; anything thrown is a
                // defect whose details belong in the log, not in the browser
                _httpServerContext?.Log?.Exception(ex);
                result = null;
            }

            if (result is null)
            {
                return CreateErrorResponse(I18N.Translate(request, "webexpress.webapp:setting.plugin.operation.error.internal"));
            }

            // the manager phrases its messages without knowing the request; they are read in
            // the language the administrator browses in, not the server's
            var message = result.GetMessage(request.Culture);

            return result.Success
                ? CreateJsonResponse(new { success = true, message })
                : CreateErrorResponse(message);
        }

        /// <summary>
        /// Returns the active packages and plugins that stop along with a package when it is
        /// deactivated - those running on it, directly or through others.
        /// </summary>
        /// <param name="packageManager">The package manager.</param>
        /// <param name="package">The package.</param>
        /// <returns>The packages that stop with it, without the package itself.</returns>
        internal static IReadOnlyList<PackageCatalogItem> GetStoppedWith(IPackageManager packageManager, PackageCatalogItem package)
        {
            var stopped = new List<PackageCatalogItem>();

            if (packageManager is null || package is null)
            {
                return stopped;
            }

            var visited = new HashSet<PackageCatalogItem> { package };
            var pending = new Queue<PackageCatalogItem>([package]);

            while (pending.TryDequeue(out var current))
            {
                foreach (var dependent in packageManager.GetDependentPackages(current.Id))
                {
                    if (visited.Add(dependent))
                    {
                        stopped.Add(dependent);
                        pending.Enqueue(dependent);
                    }
                }
            }

            return stopped;
        }

        /// <summary>
        /// Checks whether deactivating a package would stop the plugin of the application the
        /// management is reached through.
        /// </summary>
        /// <param name="packageManager">The package manager.</param>
        /// <param name="package">The package.</param>
        /// <param name="applicationContext">The application serving the management.</param>
        /// <returns>True when the package must stay active for the management to remain reachable.</returns>
        internal static bool IsRequiredByManagement(IPackageManager packageManager, PackageCatalogItem package, IApplicationContext applicationContext)
        {
            var host = applicationContext?.PluginContext?.PluginId?.ToString();

            if (package is null || string.IsNullOrWhiteSpace(host))
            {
                return false;
            }

            return GetStoppedWith(packageManager, package)
                .Prepend(package)
                .Any(x => string.Equals(x.Id, host, StringComparison.OrdinalIgnoreCase)
                    || x.Plugins.Any(p => string.Equals(p?.PluginId?.ToString(), host, StringComparison.OrdinalIgnoreCase)));
        }

        /// <summary>
        /// Resolves package id and action from request path.
        /// </summary>
        /// <param name="request">The request.</param>
        /// <returns>Tuple with package id and action.</returns>
        private static (string packageId, string action) ResolveActionPath(Request request)
        {
            var segments = request.Uri.PathSegments.Select(x => x.Value).ToList();
            if (segments.Count < 3)
            {
                return (null, null);
            }

            if (!segments[^3].Equals("action", StringComparison.OrdinalIgnoreCase))
            {
                return (null, null);
            }

            var action = segments[^2]?.ToLowerInvariant();
            if (action is not ("activate" or "deactivate" or "update"))
            {
                return (null, null);
            }

            var packageId = Uri.UnescapeDataString(segments[^1] ?? string.Empty);
            return (packageId, action);
        }

        /// <summary>
        /// Resolves package id from item route format.
        /// </summary>
        /// <param name="request">The request.</param>
        /// <returns>The package id.</returns>
        private static string ResolveItemPath(Request request)
        {
            var segments = request.Uri.PathSegments.Select(x => x.Value).ToList();
            if (segments.Count < 2)
            {
                return null;
            }

            if (!segments[^2].Equals("item", StringComparison.OrdinalIgnoreCase))
            {
                return null;
            }

            return Uri.UnescapeDataString(segments[^1] ?? string.Empty);
        }

        /// <summary>
        /// Creates a JSON response.
        /// </summary>
        /// <param name="data">The payload.</param>
        /// <returns>The response.</returns>
        private static Response CreateJsonResponse(object data)
        {
            return new ResponseOK()
            {
                Content = JsonSerializer.Serialize(data)
            }
                .AddHeaderContentType("application/json");
        }

        /// <summary>
        /// Creates an error response.
        /// </summary>
        /// <param name="message">The message.</param>
        /// <returns>The response.</returns>
        private static Response CreateErrorResponse(string message)
        {
            return new ResponseBadRequest(new StatusMessage(message));
        }
    }
}
