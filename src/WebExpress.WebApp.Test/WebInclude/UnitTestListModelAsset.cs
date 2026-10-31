using System;
using System.Collections.Generic;
using System.Linq;
using WebExpress.WebApp.WebInclude;

namespace WebExpress.WebApp.Test.WebInclude
{
    /// <summary>
    /// Verifies that the phase one list model module is shipped and registered
    /// correctly. The pure helpers in webexpress.webapp.list.model.js must be
    /// embedded as a resource and registered through an Asset attribute on
    /// IncludeJavaScript before the list control that consumes them. This guards
    /// the build pipeline part of the list migration without executing any
    /// JavaScript.
    /// </summary>
    public class UnitTestListModelAsset
    {
        private const string Model = "/assets/js/webexpress.webapp.list.model.js";
        private const string List = "/assets/js/webexpress.webapp.list.js";

        /// <summary>
        /// Reads the ordered list of Asset paths declared on IncludeJavaScript.
        /// The metadata order corresponds to the declaration order in source,
        /// which is the load order the framework applies.
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
        /// Tests that the list model module is registered through an Asset
        /// attribute on IncludeJavaScript.
        /// </summary>
        [Fact]
        public void Registered()
        {
            Assert.Contains(Model, GetAssetOrder());
        }

        /// <summary>
        /// Tests that the list model module loads before the list control, so
        /// that the control can use it at instantiation time.
        /// </summary>
        [Fact]
        public void LoadsBeforeTheListControl()
        {
            var order = GetAssetOrder();

            int model = order.IndexOf(Model);
            int list = order.IndexOf(List);

            Assert.True(model >= 0, "the list model must be registered");
            Assert.True(list >= 0, "the list control must be registered");
            Assert.True(model < list, "the list model must load before the list control");
        }

        /// <summary>
        /// Tests that the list model module is embedded as a resource in the
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
