using System;
using System.Linq;
using WebExpress.WebCore.WebComponent;
using WebExpress.WebCore.WebEndpoint;
using WebExpress.WebCore.WebPlugin;
using WebExpress.WebCore.WebUri;

namespace WebExpress.WebApp.WebSettingPage
{
    /// <summary>
    /// Resolves the uri an icon declared through <c>[Icon]</c> is actually served under.
    /// </summary>
    /// <remarks>
    /// The declared value is a path inside the owning assembly, and the manager that reads the
    /// attribute can only prefix it with a route it knows at registration time. That prefix is
    /// not where the file lives: an asset is published once per application the plugin belongs
    /// to, so only the asset manager knows the reachable uri. It is therefore looked up there
    /// rather than assembled a second time.
    ///
    /// The lookup keys on the endpoint id rather than on the route, because the folder separator
    /// of an asset route depends on how the project embeds its resources: a logical name yields
    /// "assets/img/logo.svg", the default naming "assets/img.logo.svg". The endpoint id flattens
    /// both to the same dotted form.
    /// </remarks>
    internal static class SettingIcon
    {
        /// <summary>
        /// The path element that separates the plugin-relative asset id from whatever prefix the
        /// declaring manager put in front of it.
        /// </summary>
        private const string Marker = "/assets/";

        /// <summary>
        /// Resolves a declared icon to the uri it is served under.
        /// </summary>
        /// <param name="componentHub">The component hub.</param>
        /// <param name="pluginContext">The plugin that owns the asset, or null when unknown.</param>
        /// <param name="declared">The icon route as recorded by the declaring manager.</param>
        /// <returns>The icon uri, or null when no matching asset is published.</returns>
        public static IUri Resolve(IComponentHub componentHub, IPluginContext pluginContext, IRoute declared)
        {
            var path = declared?.ToString();
            var start = path?.IndexOf(Marker, StringComparison.OrdinalIgnoreCase) ?? -1;

            if (pluginContext is null || start < 0)
            {
                return null;
            }

            var endpointId = $"{pluginContext.PluginId}.{path[(start + Marker.Length)..].Replace('/', '.')}";

            return componentHub?.AssetManager?.GetAssets(pluginContext)
                .FirstOrDefault(x => string.Equals(x.EndpointId?.ToString(), endpointId, StringComparison.OrdinalIgnoreCase))
                ?.Route?.ToUri();
        }
    }
}
