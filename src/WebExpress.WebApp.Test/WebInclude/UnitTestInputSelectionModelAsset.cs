using System;
using System.Collections.Generic;
using System.Linq;
using WebExpress.WebApp.WebInclude;

namespace WebExpress.WebApp.Test.WebInclude
{
    /// <summary>
    /// Verifies that the REST input selection model module is shipped and
    /// registered correctly. The pure helpers in
    /// webexpress.webapp.input.selection.model.js must be embedded as a resource
    /// and registered through an Asset attribute on IncludeJavaScript before the
    /// input selection control that consumes them. This guards the build pipeline
    /// part of the input selection migration without executing any JavaScript.
    /// </summary>
    public class UnitTestInputSelectionModelAsset
    {
        private const string Model = "/assets/js/webexpress.webapp.input.selection.model.js";
        private const string Input = "/assets/js/webexpress.webapp.input.selection.js";

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
        /// Tests that the input selection model module is registered through an
        /// Asset attribute on IncludeJavaScript.
        /// </summary>
        [Fact]
        public void Registered()
        {
            Assert.Contains(Model, GetAssetOrder());
        }

        /// <summary>
        /// Tests that the input selection model module loads before the input
        /// selection control, so that the control can use it at instantiation time.
        /// </summary>
        [Fact]
        public void LoadsBeforeTheInputSelectionControl()
        {
            var order = GetAssetOrder();

            int model = order.IndexOf(Model);
            int input = order.IndexOf(Input);

            Assert.True(model >= 0, "the input selection model must be registered");
            Assert.True(input >= 0, "the input selection control must be registered");
            Assert.True(model < input, "the input selection model must load before the input selection control");
        }

        /// <summary>
        /// Tests that the input selection model module is embedded as a resource
        /// in the WebExpress.WebApp assembly, so that it actually ships.
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
