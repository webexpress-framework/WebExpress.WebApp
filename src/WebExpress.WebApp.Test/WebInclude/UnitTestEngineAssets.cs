using System;
using System.Collections.Generic;
using System.Linq;
using WebExpress.WebApp.WebInclude;

namespace WebExpress.WebApp.Test.WebInclude
{
    /// <summary>
    /// Verifies that the View, State and Service engine is shipped and registered
    /// in WebExpress.WebApp. The engine (store, service, renderer, intent and the
    /// data base) plus the service and intent default registries must be embedded
    /// as resources and registered through Asset attributes on IncludeJavaScript
    /// in the correct load order, after the WebApp core and before the controls.
    /// The engine moved out of WebExpress.WebUI, which carries only static
    /// controls and has nothing to do with the dynamic data concept.
    /// </summary>
    public class UnitTestEngineAssets
    {
        private const string Core = "/assets/js/webexpress.webapp.js";
        private const string Service = "/assets/js/webexpress.webapp.service.js";
        private const string Renderer = "/assets/js/webexpress.webapp.renderer.js";
        private const string Template = "/assets/js/webexpress.webapp.template.js";
        private const string Intent = "/assets/js/webexpress.webapp.intent.js";
        private const string Data = "/assets/js/webexpress.webapp.data.js";
        private const string ViewState = "/assets/js/webexpress.webapp.viewstate.js";
        private const string ServiceDefault = "/assets/js/service/default.js";
        private const string IntentDefault = "/assets/js/intent/default.js";
        private const string BindDefault = "/assets/js/bind/default.js";
        private const string FirstControl = "/assets/js/webexpress.webapp.avatar.dropdown.js";

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
        /// Normalizes a manifest resource name into a dot separated form.
        /// </summary>
        /// <param name="resourceName">The manifest resource name.</param>
        /// <returns>The normalized name.</returns>
        private static string Normalize(string resourceName)
        {
            return resourceName.Replace('\\', '.').Replace('/', '.');
        }

        /// <summary>
        /// Tests that every engine module is registered through an Asset attribute.
        /// </summary>
        /// <param name="assetPath">The expected asset path.</param>
        [Theory]
        [InlineData(Service)]
        [InlineData(Renderer)]
        [InlineData(Template)]
        [InlineData(Intent)]
        [InlineData(Data)]
        [InlineData(ViewState)]
        [InlineData(ServiceDefault)]
        [InlineData(IntentDefault)]
        [InlineData(BindDefault)]
        public void Registered(string assetPath)
        {
            Assert.Contains(assetPath, GetAssetOrder());
        }

        /// <summary>
        /// Tests that every engine module is embedded as a resource in the
        /// WebExpress.WebApp assembly, so that it actually ships.
        /// </summary>
        /// <param name="assetPath">The expected asset path.</param>
        [Theory]
        [InlineData(Service)]
        [InlineData(Renderer)]
        [InlineData(Template)]
        [InlineData(Intent)]
        [InlineData(Data)]
        [InlineData(ViewState)]
        [InlineData(ServiceDefault)]
        [InlineData(IntentDefault)]
        [InlineData(BindDefault)]
        public void Embedded(string assetPath)
        {
            var suffix = assetPath.Substring("/assets/".Length).Replace('/', '.');
            var resources = typeof(IncludeJavaScript).Assembly.GetManifestResourceNames();

            Assert.Contains(resources, x => Normalize(x).EndsWith(suffix, StringComparison.Ordinal));
        }

        /// <summary>
        /// Tests that the engine loads after the WebApp core and in its declared
        /// order, and before the controls that depend on it.
        /// </summary>
        [Fact]
        public void EngineLoadsAfterCoreAndBeforeControls()
        {
            var order = GetAssetOrder();

            int core = order.IndexOf(Core);
            int service = order.IndexOf(Service);
            int renderer = order.IndexOf(Renderer);
            int template = order.IndexOf(Template);
            int intent = order.IndexOf(Intent);
            int data = order.IndexOf(Data);
            int viewState = order.IndexOf(ViewState);
            int firstControl = order.IndexOf(FirstControl);

            Assert.True(core >= 0, "the webapp core must be registered");
            Assert.True(core < service, "service must load after the webapp core");
            Assert.True(service < renderer, "renderer must load after service");
            Assert.True(renderer < template, "template must load after renderer");
            Assert.True(template < intent, "intent must load after template");
            Assert.True(intent < data, "the data base must load after intent");
            Assert.True(data < viewState, "the view state must load after the data base it builds on");

            Assert.True(firstControl >= 0, "a control must be registered");
            Assert.True(viewState < firstControl, "the engine must load before the controls");
        }

        /// <summary>
        /// Tests that the service and intent default registries load after the
        /// engine modules that define the registries they populate.
        /// </summary>
        [Fact]
        public void DefaultsLoadAfterEngine()
        {
            var order = GetAssetOrder();

            int service = order.IndexOf(Service);
            int intent = order.IndexOf(Intent);
            int data = order.IndexOf(Data);
            int serviceDefault = order.IndexOf(ServiceDefault);
            int intentDefault = order.IndexOf(IntentDefault);
            int bindDefault = order.IndexOf(BindDefault);

            Assert.True(serviceDefault > service, "service default must load after the service engine");
            Assert.True(intentDefault > intent, "intent default must load after the intent engine");
            Assert.True(bindDefault > data, "bind default must load after the data base it resolves");
        }
    }
}
