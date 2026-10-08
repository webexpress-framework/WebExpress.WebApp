using System;
using System.Collections.Generic;
using System.Linq;
using WebExpress.WebApp.WebInclude;

namespace WebExpress.WebApp.Test.WebInclude
{
    /// <summary>
    /// Verifies that the scrum velocity control module is shipped and registered
    /// correctly. The control and its inlined model helpers in
    /// webexpress.webapp.scrum.velocity.js must be embedded as a resource and
    /// registered through an Asset attribute on IncludeJavaScript. This guards the
    /// build pipeline part of the control without executing any JavaScript.
    /// </summary>
    public class UnitTestScrumVelocityAsset
    {
        private const string Velocity = "/assets/js/webexpress.webapp.scrum.velocity.js";

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
        /// Tests that the scrum velocity control module is registered through an
        /// Asset attribute on IncludeJavaScript.
        /// </summary>
        [Fact]
        public void Registered()
        {
            Assert.Contains(Velocity, GetAssetOrder());
        }

        /// <summary>
        /// Tests that the scrum velocity control module is embedded as a resource
        /// in the WebExpress.WebApp assembly, so that it actually ships.
        /// </summary>
        [Fact]
        public void Embedded()
        {
            var suffix = Velocity.Substring("/assets/".Length).Replace('/', '.');
            var resources = typeof(IncludeJavaScript).Assembly.GetManifestResourceNames();

            Assert.Contains(resources, x => x.Replace('\\', '.').Replace('/', '.').EndsWith(suffix, StringComparison.Ordinal));
        }
    }
}
