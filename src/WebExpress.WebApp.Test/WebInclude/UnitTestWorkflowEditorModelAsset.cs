using System;
using System.Collections.Generic;
using System.Linq;
using WebExpress.WebApp.WebInclude;

namespace WebExpress.WebApp.Test.WebInclude
{
    /// <summary>
    /// Verifies that the workflow editor model module is shipped and registered
    /// correctly. The pure helpers in webexpress.webapp.workflow.editor.model.js
    /// must be embedded as a resource and registered through an Asset attribute
    /// on IncludeJavaScript before the workflow editor control that consumes
    /// them. This guards the build pipeline part of the workflow editor migration
    /// without executing any JavaScript.
    /// </summary>
    public class UnitTestWorkflowEditorModelAsset
    {
        private const string Model = "/assets/js/webexpress.webapp.workflow.editor.model.js";
        private const string Editor = "/assets/js/webexpress.webapp.workflow.editor.js";

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
        /// Tests that the workflow editor model module is registered through an
        /// Asset attribute on IncludeJavaScript.
        /// </summary>
        [Fact]
        public void Registered()
        {
            Assert.Contains(Model, GetAssetOrder());
        }

        /// <summary>
        /// Tests that the workflow editor model module loads before the workflow
        /// editor control, so that the control can use it at instantiation time.
        /// </summary>
        [Fact]
        public void LoadsBeforeTheWorkflowEditorControl()
        {
            var order = GetAssetOrder();

            int model = order.IndexOf(Model);
            int editor = order.IndexOf(Editor);

            Assert.True(model >= 0, "the workflow editor model must be registered");
            Assert.True(editor >= 0, "the workflow editor control must be registered");
            Assert.True(model < editor, "the workflow editor model must load before the workflow editor control");
        }

        /// <summary>
        /// Tests that the workflow editor model module is embedded as a resource
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
