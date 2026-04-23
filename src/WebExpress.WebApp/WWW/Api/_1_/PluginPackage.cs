using System;
using System.Linq;
using System.Text.Json;
using WebExpress.WebApp.WebPackage;
using WebExpress.WebApp.WebScope;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebComponent;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebParameter;
using WebExpress.WebCore.WebRestApi;

namespace WebExpress.WebApp.WWW.Api.V1
{
    /// <summary>
    /// REST API for plugin package management.
    /// </summary>
    [IncludeSubPaths(true)]
    [Scope<IScopeAdmin>]
    public sealed class PluginPackage : IRestApi
    {
        private readonly IComponentHub _componentHub;
        private readonly PluginPackageService _service;

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="componentHub">The component hub.</param>
        /// <param name="pluginPackageService">The package service.</param>
        public PluginPackage(IComponentHub componentHub, PluginPackageService pluginPackageService)
        {
            _componentHub = componentHub;
            _service = pluginPackageService;
        }

        /// <summary>
        /// Retrieves package information.
        /// </summary>
        /// <param name="request">The request.</param>
        /// <returns>The response.</returns>
        [Method(RequestMethod.GET)]
        public Response Retrieve(Request request)
        {
            var packages = _componentHub.PackageManager.Catalog.Packages
                .Where(x => x is not null)
                .OrderBy(x => x.Id)
                .Select(x => new
                {
                    id = x.Id,
                    file = x.File,
                    state = x.State.ToString(),
                    version = x.Metadata?.Version,
                    title = x.Metadata?.Title,
                    description = x.Metadata?.Description,
                    authors = x.Metadata?.Authors,
                    pluginSources = x.Metadata?.PluginSources?.ToArray() ?? [],
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
            if (file is null)
            {
                return CreateErrorResponse("No package file was uploaded.");
            }

            var result = _service.Install(file.Value, file.Data);

            return result.Success
                ? CreateJsonResponse(new { success = true, message = result.Message })
                : CreateErrorResponse(result.Message);
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
                return CreateErrorResponse("Missing package id or action.");
            }

            var result = action switch
            {
                "activate" => _service.Activate(packageId),
                "deactivate" => _service.Deactivate(packageId),
                "update" => UpdatePackage(packageId, request),
                _ => PluginPackageOperationResult.Failed("Unknown package action.")
            };

            return result.Success
                ? CreateJsonResponse(new { success = true, message = result.Message })
                : CreateErrorResponse(result.Message);
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
                return CreateErrorResponse("Missing package id.");
            }

            var result = _service.Delete(packageId);

            return result.Success
                ? CreateJsonResponse(new { success = true, message = result.Message })
                : CreateErrorResponse(result.Message);
        }

        /// <summary>
        /// Handles update action with uploaded package data.
        /// </summary>
        /// <param name="packageId">The package id.</param>
        /// <param name="request">The request.</param>
        /// <returns>The operation result.</returns>
        private PluginPackageOperationResult UpdatePackage(string packageId, Request request)
        {
            var file = request.Parameters.OfType<ParameterFile>().FirstOrDefault();
            if (file is null)
            {
                return PluginPackageOperationResult.Failed("No package file was uploaded.");
            }

            return _service.Update(packageId, file.Data);
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
            }.AddHeaderContentType("application/json");
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
