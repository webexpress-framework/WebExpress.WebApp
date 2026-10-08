using System;
using System.Collections.Generic;
using System.Linq;
using WebExpress.WebApp.WebInclude;

namespace WebExpress.WebApp.Test.WebInclude
{
    /// <summary>
    /// Verifies that the phase two REST tab model module is shipped and
    /// registered correctly. The pure helpers in webexpress.webapp.tab.model.js
    /// must be embedded as a resource and registered through an Asset attribute
    /// on IncludeJavaScript before the tab control that consumes them. This
    /// guards the build pipeline part of the tab migration without executing any
    /// JavaScript.
    /// </summary>
    public class UnitTestTabModelAsset
    {
        private const string Model = "/assets/js/webexpress.webapp.tab.model.js";
        private const string Tab = "/assets/js/webexpress.webapp.tab.js";

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
        /// Tests that the tab model module is registered through an Asset
        /// attribute on IncludeJavaScript.
        /// </summary>
        [Fact]
        public void Registered()
        {
            Assert.Contains(Model, GetAssetOrder());
        }

        /// <summary>
        /// Tests that the tab model module loads before the tab control, so that
        /// the control can use it at instantiation time.
        /// </summary>
        [Fact]
        public void LoadsBeforeTheTabControl()
        {
            var order = GetAssetOrder();

            int model = order.IndexOf(Model);
            int tab = order.IndexOf(Tab);

            Assert.True(model >= 0, "the tab model must be registered");
            Assert.True(tab >= 0, "the tab control must be registered");
            Assert.True(model < tab, "the tab model must load before the tab control");
        }

        /// <summary>
        /// Tests that the tab model module is embedded as a resource in the
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
