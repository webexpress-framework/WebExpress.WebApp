using System;
using System.Collections.Generic;
using System.Linq;
using WebExpress.WebApp.WebInclude;

namespace WebExpress.WebApp.Test.WebInclude
{
    /// <summary>
    /// Verifies that the watcher model module is shipped and registered
    /// correctly. The pure helpers in webexpress.webapp.watcher.model.js must be
    /// embedded as a resource and registered through an Asset attribute on
    /// IncludeJavaScript before the watcher control that consumes them. This
    /// guards the build pipeline part of the watcher migration without executing
    /// any JavaScript.
    /// </summary>
    public class UnitTestWatcherModelAsset
    {
        private const string Model = "/assets/js/webexpress.webapp.watcher.model.js";
        private const string Watcher = "/assets/js/webexpress.webapp.watcher.js";

        /// <summary>
        /// Reads the ordered list of Asset paths declared on IncludeJavaScript.
        /// </summary>
        /// <returns>The ordered list of asset paths.</returns>
        private static List<string> GetAssetOrder()
        {
            return typeof(IncludeJavaScript)
                .GetCustomAttributesData()
                .Where(x => x.AttributeType.Name == "AssetAttribute")
                .Select(x => x.ConstructorArguments.FirstOrDefault().Value as string)
                .Where(x => x is not null)
                .ToList();
        }

        /// <summary>
        /// Tests that the watcher model module is registered through an Asset
        /// attribute on IncludeJavaScript.
        /// </summary>
        [Fact]
        public void Registered()
        {
            Assert.Contains(Model, GetAssetOrder());
        }

        /// <summary>
        /// Tests that the watcher model module loads before the watcher control,
        /// so that the control can use it at instantiation time.
        /// </summary>
        [Fact]
        public void LoadsBeforeTheWatcherControl()
        {
            var order = GetAssetOrder();

            int model = order.IndexOf(Model);
            int watcher = order.IndexOf(Watcher);

            Assert.True(model >= 0, "the watcher model must be registered");
            Assert.True(watcher >= 0, "the watcher control must be registered");
            Assert.True(model < watcher, "the watcher model must load before the watcher control");
        }

        /// <summary>
        /// Tests that the watcher model module is embedded as a resource in the
        /// WebExpress.WebApp assembly, so that it actually ships.
        /// </summary>
        [Fact]
        public void Embedded()
        {
            var suffix = Model.Substring("/assets/".Length).Replace('/', '.');
            var resources = typeof(IncludeJavaScript).Assembly.GetManifestResourceNames();

            Assert.Contains(resources, x => x.Replace('\\', '.').Replace('/', '.').EndsWith(suffix, StringComparison.Ordinal));
        }
    }
}
