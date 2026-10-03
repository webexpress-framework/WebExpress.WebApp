using System.Collections.Generic;
using System.IO;
using WebExpress.WebCore;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebComponent;
using WebExpress.WebCore.WebPlugin;
using WebExpress.WebIndex;

namespace WebExpress.WebApp.WebIndex
{
    /// <summary>
    /// Manages the index for the web application and handles component registration and removal.
    /// </summary>
    public sealed class IndexManager : WebExpress.WebIndex.IndexManager, IIndexManager
    {
        private readonly IHttpServerContext _httpServerContext;
        private readonly IComponentHub _componentHub;

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="httpServerContext">The reference to the context of the host.</param>
        /// <param name="componentHub">The component hub.</param>
        internal IndexManager(IHttpServerContext httpServerContext, IComponentHub componentHub)
        {
            _httpServerContext = httpServerContext;
            _componentHub = componentHub;

            // webindex is a library rather than a plugin, so the plugin scan never reaches its
            // language files and the wql parser's messages would surface as raw keys
            var webIndex = typeof(WebExpress.WebIndex.IndexManager).Assembly;
            (_componentHub?.InternationalizationManager as InternationalizationManager)?
                .Register(webIndex, webIndex.GetName().Name.ToLower());

            _componentHub?.PluginManager?.AddPlugin += (s, pluginContext) =>
            {
                Register(pluginContext);
            };

            _componentHub?.PluginManager?.RemovePlugin += (s, pluginContext) =>
            {
                Remove(pluginContext);
            };

            _httpServerContext?.Log?.Debug
            (
                I18N.Translate("webexpress.webapp:indexmanager.initialization")
            );

            Initialization(new IndexContext() { IndexDirectory = Path.Combine(httpServerContext.DataPath, "index") });
        }

        /// <summary>
        /// Discovers and registers entries from the specified plugin.
        /// </summary>
        /// <param name="pluginContext">A context of a plugin whose elements are to be registered.</param>
        public void Register(IPluginContext pluginContext)
        {

        }

        /// <summary>
        /// Discovers and registers entries from the specified plugin.
        /// </summary>
        /// <param name="pluginContexts">A list with plugin contexts that contain the components.</param>
        public void Register(IEnumerable<IPluginContext> pluginContexts)
        {
            foreach (var pluginContext in pluginContexts)
            {
                Register(pluginContext);
            }
        }

        /// <summary>
        /// Removes all components associated with the specified plugin context.
        /// </summary>
        /// <param name="pluginContext">The context of the plugin that contains the components to remove.</param>
        public void Remove(IPluginContext pluginContext)
        {

        }
    }
}
