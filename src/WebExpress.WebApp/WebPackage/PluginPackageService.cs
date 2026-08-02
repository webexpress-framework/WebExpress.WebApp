using System;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Reflection;
using System.Threading;
using WebExpress.WebCore;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebComponent;
using WebExpress.WebCore.WebPackage.Model;

namespace WebExpress.WebApp.WebPackage
{
    /// <summary>
    /// Provides package-level plugin management operations for the web UI.
    /// </summary>
    public sealed class PluginPackageService
    {
        private const int MaxPackageSizeBytes = 100 * 1024 * 1024;
        private readonly Lock _operationLock = new();

        private readonly IComponentHub _componentHub;
        private readonly IHttpServerContext _httpServerContext;

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="componentHub">The component hub.</param>
        /// <param name="httpServerContext">The server context.</param>
        public PluginPackageService(IComponentHub componentHub, IHttpServerContext httpServerContext)
        {
            _componentHub = componentHub;
            _httpServerContext = httpServerContext;
        }

        /// <summary>
        /// Installs a package from uploaded bytes and triggers a package scan.
        /// </summary>
        /// <param name="fileName">The uploaded file name.</param>
        /// <param name="data">The uploaded bytes.</param>
        /// <returns>The operation result.</returns>
        public PluginPackageOperationResult Install(string fileName, byte[] data)
        {
            lock (_operationLock)
            {
                var validation = ValidateUpload(fileName, data);
                if (!validation.Success)
                {
                    return validation;
                }

                try
                {
                    var targetPath = Path.Combine(_httpServerContext?.PackagePath, Path.GetFileName(fileName));

                    Directory.CreateDirectory(_httpServerContext?.PackagePath);
                    File.WriteAllBytes(targetPath, data);

                    Invoke(_componentHub?.PackageManager, "Scan");

                    return PluginPackageOperationResult.Ok
                    (
                        I18N.Translate("webexpress.webapp:setting.plugin.operation.install.success", Path.GetFileName(fileName))
                    );
                }
                catch (Exception ex)
                {
                    _httpServerContext?.Log?.Exception(ex);
                    return PluginPackageOperationResult.Failed
                    (
                        I18N.Translate("webexpress.webapp:setting.plugin.operation.error.internal")
                    );
                }
            }
        }

        /// <summary>
        /// Updates an existing package with a new uploaded package file and triggers a scan.
        /// </summary>
        /// <param name="packageId">The package id.</param>
        /// <param name="data">The package bytes.</param>
        /// <returns>The operation result.</returns>
        public PluginPackageOperationResult Update(string packageId, byte[] data)
        {
            lock (_operationLock)
            {
                var package = FindPackage(packageId);
                if (package is null)
                {
                    return PluginPackageOperationResult.Failed
                    (
                        I18N.Translate("webexpress.webapp:setting.plugin.operation.error.notfound", packageId)
                    );
                }

                var builtIn = RejectBuiltIn(package);
                if (builtIn is not null)
                {
                    return builtIn;
                }

                var validation = ValidateUpload(package.File, data);
                if (!validation.Success)
                {
                    return validation;
                }

                try
                {
                    var targetPath = Path.Combine(_httpServerContext?.PackagePath, package.File);
                    File.WriteAllBytes(targetPath, data);

                    Invoke(_componentHub?.PackageManager, "Scan");

                    return PluginPackageOperationResult.Ok
                    (
                        I18N.Translate("webexpress.webapp:setting.plugin.operation.update.success", packageId)
                    );
                }
                catch (Exception ex)
                {
                    _httpServerContext?.Log?.Exception(ex);
                    return PluginPackageOperationResult.Failed
                    (
                        I18N.Translate("webexpress.webapp:setting.plugin.operation.error.internal")
                    );
                }
            }
        }

        /// <summary>
        /// Activates a package.
        /// </summary>
        /// <param name="packageId">The package id.</param>
        /// <returns>The operation result.</returns>
        public PluginPackageOperationResult Activate(string packageId)
        {
            lock (_operationLock)
            {
                var package = FindPackage(packageId);
                if (package is null)
                {
                    return PluginPackageOperationResult.Failed
                    (
                        I18N.Translate("webexpress.webapp:setting.plugin.operation.error.notfound", packageId)
                    );
                }

                var builtIn = RejectBuiltIn(package);
                if (builtIn is not null)
                {
                    return builtIn;
                }

                if (package.State == PackageCatalogeItemState.Active)
                {
                    return PluginPackageOperationResult.Ok
                    (
                        I18N.Translate("webexpress.webapp:setting.plugin.operation.activate.success", packageId)
                    );
                }

                var previousId = package.Id;
                var previousMetadata = package.Metadata;
                var previousState = package.State;

                try
                {
                    var packageManager = _componentHub?.PackageManager;
                    var packageFilePath = Path.Combine(_httpServerContext?.PackagePath, package.File);
                    var metadata = Invoke(packageManager, "LoadPackage", packageFilePath) as PackageCatalogItem;

                    package.Id = metadata?.Id ?? package.Id;
                    package.Metadata = metadata?.Metadata ?? package.Metadata;
                    package.State = PackageCatalogeItemState.Active;

                    Invoke(packageManager, "ExtractPackage", package);
                    Invoke(packageManager, "RegisterPackage", package);
                    Invoke(packageManager, "BootPackage", package);
                    Invoke(packageManager, "SaveCatalog");
                    _componentHub?.SitemapManager.Refresh();

                    return PluginPackageOperationResult.Ok
                    (
                        I18N.Translate("webexpress.webapp:setting.plugin.operation.activate.success", packageId)
                    );
                }
                catch (Exception ex)
                {
                    package.Id = previousId;
                    package.Metadata = previousMetadata;
                    package.State = previousState;
                    _httpServerContext?.Log?.Exception(ex);
                    return PluginPackageOperationResult.Failed
                    (
                        I18N.Translate("webexpress.webapp:setting.plugin.operation.error.internal")
                    );
                }
            }
        }

        /// <summary>
        /// Deactivates a package.
        /// </summary>
        /// <param name="packageId">The package id.</param>
        /// <returns>The operation result.</returns>
        public PluginPackageOperationResult Deactivate(string packageId)
        {
            lock (_operationLock)
            {
                var package = FindPackage(packageId);
                if (package is null)
                {
                    return PluginPackageOperationResult.Failed
                    (
                        I18N.Translate("webexpress.webapp:setting.plugin.operation.error.notfound", packageId)
                    );
                }

                var builtIn = RejectBuiltIn(package);
                if (builtIn is not null)
                {
                    return builtIn;
                }

                if (package.State == PackageCatalogeItemState.Disable)
                {
                    return PluginPackageOperationResult.Ok
                    (
                        I18N.Translate("webexpress.webapp:setting.plugin.operation.deactivate.success", packageId)
                    );
                }

                try
                {
                    var packageManager = _componentHub?.PackageManager;

                    Invoke(packageManager, "DeactivateAndUnregisterPackage", package);
                    Invoke(packageManager, "RemoveExtractedDirectory", package);

                    package.State = PackageCatalogeItemState.Disable;

                    Invoke(packageManager, "SaveCatalog");
                    _componentHub?.SitemapManager.Refresh();

                    return PluginPackageOperationResult.Ok
                    (
                        I18N.Translate("webexpress.webapp:setting.plugin.operation.deactivate.success", packageId)
                    );
                }
                catch (Exception ex)
                {
                    _httpServerContext?.Log?.Exception(ex);
                    return PluginPackageOperationResult.Failed
                    (
                        I18N.Translate("webexpress.webapp:setting.plugin.operation.error.internal")
                    );
                }
            }
        }

        /// <summary>
        /// Deletes a package and removes all related runtime artifacts.
        /// </summary>
        /// <param name="packageId">The package id.</param>
        /// <returns>The operation result.</returns>
        public PluginPackageOperationResult Delete(string packageId)
        {
            lock (_operationLock)
            {
                var package = FindPackage(packageId);
                if (package is null)
                {
                    return PluginPackageOperationResult.Failed
                    (
                        I18N.Translate("webexpress.webapp:setting.plugin.operation.error.notfound", packageId)
                    );
                }

                var builtIn = RejectBuiltIn(package);
                if (builtIn is not null)
                {
                    return builtIn;
                }

                try
                {
                    var packageManager = _componentHub?.PackageManager;

                    if (package.State == PackageCatalogeItemState.Active)
                    {
                        Invoke(packageManager, "DeactivateAndUnregisterPackage", package);
                    }

                    Invoke(packageManager, "RemoveExtractedDirectory", package);

                    var packageFilePath = Path.Combine(_httpServerContext?.PackagePath, package.File);
                    if (File.Exists(packageFilePath))
                    {
                        File.Delete(packageFilePath);
                    }

                    Invoke(packageManager, "OnRemovePackage", package);
                    _componentHub?.PackageManager.Catalog.Packages.Remove(package);

                    Invoke(packageManager, "SaveCatalog");
                    _componentHub?.SitemapManager.Refresh();

                    return PluginPackageOperationResult.Ok
                    (
                        I18N.Translate("webexpress.webapp:setting.plugin.operation.delete.success", packageId)
                    );
                }
                catch (Exception ex)
                {
                    _httpServerContext?.Log?.Exception(ex);
                    return PluginPackageOperationResult.Failed
                    (
                        I18N.Translate("webexpress.webapp:setting.plugin.operation.error.internal")
                    );
                }
            }
        }

        /// <summary>
        /// Finds a package by id, the installed ones as well as the plugins that ship with the
        /// application.
        /// </summary>
        /// <remarks>
        /// Resolving through the package manager rather than through the catalog is what lets a
        /// request that addresses a built-in plugin be answered with the reason it cannot be
        /// carried out instead of with "not found".
        /// </remarks>
        /// <param name="packageId">The package id.</param>
        /// <returns>The package catalog item or null.</returns>
        public PackageCatalogItem FindPackage(string packageId)
        {
            return _componentHub?.PackageManager?.GetPackage(packageId);
        }

        /// <summary>
        /// Rejects an operation that was addressed to a plugin shipping with the application.
        /// </summary>
        /// <remarks>
        /// Such a plugin lives in the application directory and is loaded into the default context;
        /// it can neither be replaced nor removed while the process runs. The refusal is issued
        /// before the first step so the request cannot leave the plugin half unregistered.
        /// </remarks>
        /// <param name="package">The addressed package.</param>
        /// <returns>The failure result, or null when the package may be operated on.</returns>
        private static PluginPackageOperationResult RejectBuiltIn(PackageCatalogItem package)
        {
            return package is not null && package.BuiltIn
                ? PluginPackageOperationResult.Failed
                (
                    I18N.Translate("webexpress.webapp:setting.plugin.operation.error.builtin", package.Id)
                )
                : null;
        }

        /// <summary>
        /// Validates an uploaded package.
        /// </summary>
        /// <param name="fileName">The file name.</param>
        /// <param name="data">The data.</param>
        /// <returns>The validation result.</returns>
        private PluginPackageOperationResult ValidateUpload(string fileName, byte[] data)
        {
            if (string.IsNullOrWhiteSpace(fileName) || !fileName.EndsWith(".wxp", StringComparison.OrdinalIgnoreCase))
            {
                return PluginPackageOperationResult.Failed
                (
                    I18N.Translate("webexpress.webapp:setting.plugin.operation.error.invalidfile")
                );
            }

            if (data is null || data.Length == 0)
            {
                return PluginPackageOperationResult.Failed
                (
                    I18N.Translate("webexpress.webapp:setting.plugin.operation.error.empty")
                );
            }

            if (data.Length > MaxPackageSizeBytes)
            {
                return PluginPackageOperationResult.Failed
                (
                    I18N.Translate("webexpress.webapp:setting.plugin.operation.error.toobig")
                );
            }

            try
            {
                using var memoryStream = new MemoryStream(data);
                using var archive = new ZipArchive(memoryStream, ZipArchiveMode.Read, leaveOpen: false);
                var spec = archive.Entries.FirstOrDefault(x => x.FullName.EndsWith(".spec", StringComparison.OrdinalIgnoreCase));
                if (spec is null)
                {
                    return PluginPackageOperationResult.Failed
                    (
                        I18N.Translate("webexpress.webapp:setting.plugin.operation.error.invalidpackage")
                    );
                }
            }
            catch
            {
                return PluginPackageOperationResult.Failed
                (
                    I18N.Translate("webexpress.webapp:setting.plugin.operation.error.invalidpackage")
                );
            }

            return PluginPackageOperationResult.Ok(string.Empty);
        }

        /// <summary>
        /// Invokes a private instance method by name.
        /// </summary>
        /// <param name="instance">The target instance.</param>
        /// <param name="methodName">The method name.</param>
        /// <param name="parameters">The parameters.</param>
        /// <returns>The invocation result.</returns>
        private static object Invoke(object instance, string methodName, params object[] parameters)
        {
            var method = instance?.GetType().GetMethod
            (
                methodName,
                BindingFlags.Instance | BindingFlags.NonPublic | BindingFlags.Public
            );

            if (method is null)
            {
                throw new MissingMethodException(instance?.GetType().FullName, methodName);
            }

            return method.Invoke(instance, parameters);
        }
    }
}
