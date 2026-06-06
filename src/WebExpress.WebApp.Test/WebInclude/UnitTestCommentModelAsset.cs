using System;
using System.Collections.Generic;
using System.Linq;
using WebExpress.WebApp.WebInclude;

namespace WebExpress.WebApp.Test.WebInclude
{
    /// <summary>
    /// Verifies that the phase two REST comment model module is shipped and
    /// registered correctly. The pure helpers in
    /// webexpress.webapp.comment.model.js must be embedded as a resource and
    /// registered through an Asset attribute on IncludeJavaScript before the
    /// comment control that consumes them. This guards the build pipeline part
    /// of the comment migration without executing any JavaScript.
    /// </summary>
    public class UnitTestCommentModelAsset
    {
        private const string Model = "/assets/js/webexpress.webapp.comment.model.js";
        private const string Comment = "/assets/js/webexpress.webapp.comment.js";

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
        /// Tests that the comment model module is registered through an Asset
        /// attribute on IncludeJavaScript.
        /// </summary>
        [Fact]
        public void Registered()
        {
            Assert.Contains(Model, GetAssetOrder());
        }

        /// <summary>
        /// Tests that the comment model module loads before the comment control,
        /// so that the control can use it at instantiation time.
        /// </summary>
        [Fact]
        public void LoadsBeforeTheCommentControl()
        {
            var order = GetAssetOrder();

            int model = order.IndexOf(Model);
            int comment = order.IndexOf(Comment);

            Assert.True(model >= 0, "the comment model must be registered");
            Assert.True(comment >= 0, "the comment control must be registered");
            Assert.True(model < comment, "the comment model must load before the comment control");
        }

        /// <summary>
        /// Tests that the comment model module is embedded as a resource in the
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
