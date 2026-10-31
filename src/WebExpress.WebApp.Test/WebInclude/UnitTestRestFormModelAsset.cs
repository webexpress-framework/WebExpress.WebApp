using WebExpress.WebApp.WebInclude;

namespace WebExpress.WebApp.Test.WebInclude
{
    /// <summary>
    /// Verifies that the phase two REST form model module is shipped and
    /// registered correctly. The pure helpers in
    /// webexpress.webapp.restform.model.js must be embedded as a resource and
    /// registered through an Asset attribute on IncludeJavaScript before the
    /// form control that consumes them. This guards the build pipeline part of
    /// the form migration without executing any JavaScript.
    /// </summary>
    public class UnitTestRestFormModelAsset
    {
        private const string Model = "/assets/js/webexpress.webapp.restform.model.js";
        private const string Form = "/assets/js/webexpress.webapp.restform.js";

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
        /// Tests that the form model module is registered through an Asset
        /// attribute on IncludeJavaScript.
        /// </summary>
        [Fact]
        public void Registered()
        {
            Assert.Contains(Model, GetAssetOrder());
        }

        /// <summary>
        /// Tests that the form model module loads before the form control, so
        /// that the control can use it at instantiation time.
        /// </summary>
        [Fact]
        public void LoadsBeforeTheFormControl()
        {
            var order = GetAssetOrder();

            int model = order.IndexOf(Model);
            int form = order.IndexOf(Form);

            Assert.True(model >= 0, "the form model must be registered");
            Assert.True(form >= 0, "the form control must be registered");
            Assert.True(model < form, "the form model must load before the form control");
        }

        /// <summary>
        /// Tests that the form model module is embedded as a resource in the
        /// WebExpress.WebApp assembly, so that it actually ships.
        /// </summary>
        [Fact]
        public void Embedded()
        {
            var suffix = Model["/assets/".Length..].Replace('/', '.');
            var resources = typeof(IncludeJavaScript).Assembly.GetManifestResourceNames();

            Assert.Contains(resources, x => x.Replace('\\', '.').Replace('/', '.').EndsWith(suffix, StringComparison.Ordinal));
        }
    }
}
