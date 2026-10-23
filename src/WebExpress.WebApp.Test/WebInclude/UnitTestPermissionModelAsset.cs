using System;
using System.Collections.Generic;
using System.Linq;
using WebExpress.WebApp.WebInclude;

namespace WebExpress.WebApp.Test.WebInclude
{
    /// <summary>
    /// Verifies that the permission model module is shipped and registered
    /// correctly. The pure helpers in webexpress.webapp.permission.model.js must
    /// be embedded as a resource and registered through an Asset attribute on
    /// IncludeJavaScript before the permission control that consumes them. This
    /// guards the build pipeline part of the permission control without
    /// executing any JavaScript.
    /// </summary>
    public class UnitTestPermissionModelAsset
    {
        private const string Model = "/assets/js/webexpress.webapp.permission.model.js";
        private const string Permission = "/assets/js/webexpress.webapp.permission.js";

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
        /// Tests that the permission model module is registered through an Asset
        /// attribute on IncludeJavaScript.
        /// </summary>
        [Fact]
        public void Registered()
        {
            Assert.Contains(Model, GetAssetOrder());
        }

        /// <summary>
        /// Tests that the permission model module loads before the permission
        /// control, so that the control can use it at instantiation time.
        /// </summary>
        [Fact]
        public void LoadsBeforeThePermissionControl()
        {
            var order = GetAssetOrder();

            int model = order.IndexOf(Model);
            int permission = order.IndexOf(Permission);

            Assert.True(model >= 0, "the permission model must be registered");
            Assert.True(permission >= 0, "the permission control must be registered");
            Assert.True(model < permission, "the permission model must load before the permission control");
        }

        /// <summary>
        /// Tests that the permission model module is embedded as a resource in
        /// the WebExpress.WebApp assembly, so that it actually ships.
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
