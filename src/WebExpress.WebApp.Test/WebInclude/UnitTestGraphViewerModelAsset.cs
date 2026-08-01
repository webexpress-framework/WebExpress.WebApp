using System;
using System.Collections.Generic;
using System.Linq;
using WebExpress.WebApp.WebInclude;

namespace WebExpress.WebApp.Test.WebInclude
{
    /// <summary>
    /// Verifies that the REST graph viewer modules are shipped and registered
    /// correctly. The pure helpers in webexpress.webapp.graph.viewer.model.js and
    /// the control in webexpress.webapp.graph.viewer.js must be embedded as
    /// resources and registered through Asset attributes on IncludeJavaScript,
    /// with the model ahead of the control that consumes it. This guards the
    /// build pipeline part of the control without executing any JavaScript.
    /// </summary>
    public class UnitTestGraphViewerModelAsset
    {
        private const string Model = "/assets/js/webexpress.webapp.graph.viewer.model.js";
        private const string GraphViewer = "/assets/js/webexpress.webapp.graph.viewer.js";

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
        /// Tests that the graph viewer model module is registered through an Asset
        /// attribute on IncludeJavaScript.
        /// </summary>
        [Fact]
        public void Registered()
        {
            Assert.Contains(Model, GetAssetOrder());
        }

        /// <summary>
        /// Tests that the graph viewer model module loads before the graph viewer
        /// control, so that the control can use it at instantiation time.
        /// </summary>
        [Fact]
        public void LoadsBeforeTheGraphViewerControl()
        {
            var order = GetAssetOrder();

            int model = order.IndexOf(Model);
            int graphViewer = order.IndexOf(GraphViewer);

            Assert.True(model >= 0, "the graph viewer model must be registered");
            Assert.True(graphViewer >= 0, "the graph viewer control must be registered");
            Assert.True(model < graphViewer, "the graph viewer model must load before the graph viewer control");
        }

        /// <summary>
        /// Tests that the graph viewer modules are embedded as resources in the
        /// WebExpress.WebApp assembly, so that they actually ship.
        /// </summary>
        [Theory]
        [InlineData(Model)]
        [InlineData(GraphViewer)]
        public void Embedded(string asset)
        {
            var suffix = asset.Substring("/assets/".Length).Replace('/', '.');
            var resources = typeof(IncludeJavaScript).Assembly.GetManifestResourceNames();

            Assert.Contains(resources, x => x.Replace('\\', '.').Replace('/', '.').EndsWith(suffix, StringComparison.Ordinal));
        }
    }
}
