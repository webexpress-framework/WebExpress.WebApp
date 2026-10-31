using System;
using System.Collections.Generic;
using System.Linq;
using WebExpress.WebApp.WebInclude;

namespace WebExpress.WebApp.Test.WebInclude
{
    /// <summary>
    /// Verifies that the phase two REST wizard model module is shipped and
    /// registered correctly. The pure helpers in
    /// webexpress.webapp.restwizard.model.js must be embedded as a resource and
    /// registered through an Asset attribute on IncludeJavaScript before the
    /// wizard control that consumes them. This guards the build pipeline part of
    /// the wizard migration without executing any JavaScript.
    /// </summary>
    public class UnitTestRestWizardModelAsset
    {
        private const string Model = "/assets/js/webexpress.webapp.restwizard.model.js";
        private const string Wizard = "/assets/js/webexpress.webapp.restwizard.js";

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
        /// Tests that the wizard model module is registered through an Asset
        /// attribute on IncludeJavaScript.
        /// </summary>
        [Fact]
        public void Registered()
        {
            Assert.Contains(Model, GetAssetOrder());
        }

        /// <summary>
        /// Tests that the wizard model module loads before the wizard control,
        /// so that the control can use it at instantiation time.
        /// </summary>
        [Fact]
        public void LoadsBeforeTheWizardControl()
        {
            var order = GetAssetOrder();

            int model = order.IndexOf(Model);
            int wizard = order.IndexOf(Wizard);

            Assert.True(model >= 0, "the wizard model must be registered");
            Assert.True(wizard >= 0, "the wizard control must be registered");
            Assert.True(model < wizard, "the wizard model must load before the wizard control");
        }

        /// <summary>
        /// Tests that the wizard model module is embedded as a resource in the
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
