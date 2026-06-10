using System;
using WebExpress.WebApp.WebData;
using WebExpress.WebCore;
using WebExpress.WebCore.WebEndpoint;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// The family presets of the fluent data authoring surface. Each data
    /// control family already owns a canonical service shape (its historical
    /// query parameter and response names, shared with the JavaScript
    /// legacyDescriptor), so declaring the standard service takes a single
    /// typed call: the endpoint type is the only thing the page contributes,
    /// and it is resolved through the sitemap at render time. No wire name is
    /// spelled at the call site.
    ///
    /// <code>
    /// new ControlDataList("orders")
    ///     .State(s => s.Page(0).PageSize(25))
    ///     .DataService&lt;OrderRestApi&gt;();
    /// </code>
    ///
    /// The optional configure callback adjusts the preset, for example with
    /// MapError or WithRetry, and the generic Service extension stays available
    /// for fully bespoke contracts.
    /// </summary>
    public static class ControlDataAuthoringExtensions
    {
        /// <summary>
        /// Declares the standard data service of the list, which queries with
        /// GET and carries the historical list parameter and response names.
        /// </summary>
        /// <typeparam name="TEndpoint">The endpoint type that owns the route.</typeparam>
        /// <param name="control">The list control.</param>
        /// <param name="configure">An optional adjustment of the preset.</param>
        /// <returns>The control for chaining.</returns>
        public static ControlDataList DataService<TEndpoint>(this ControlDataList control, Action<DataServiceDescriptor> configure = null)
            where TEndpoint : IEndpoint
        {
            return AddPreset(control, DataServiceDescriptor.ListData, Endpoint<TEndpoint>(), configure);
        }

        /// <summary>
        /// Declares the standard data service of the table, which queries with
        /// GET, persists a reordered row set with PUT and carries the
        /// historical table parameter and response names.
        /// </summary>
        /// <typeparam name="TEndpoint">The endpoint type that owns the route.</typeparam>
        /// <param name="control">The table control.</param>
        /// <param name="configure">An optional adjustment of the preset.</param>
        /// <returns>The control for chaining.</returns>
        public static ControlDataTable DataService<TEndpoint>(this ControlDataTable control, Action<DataServiceDescriptor> configure = null)
            where TEndpoint : IEndpoint
        {
            return AddPreset(control, DataServiceDescriptor.TableData, Endpoint<TEndpoint>(), configure);
        }

        /// <summary>
        /// Declares the standard data service of the tab, which loads with GET,
        /// persists with PUT, maps the logical id parameter and projects the
        /// items response.
        /// </summary>
        /// <typeparam name="TEndpoint">The endpoint type that owns the route.</typeparam>
        /// <param name="control">The tab control.</param>
        /// <param name="configure">An optional adjustment of the preset.</param>
        /// <returns>The control for chaining.</returns>
        public static ControlDataTab DataService<TEndpoint>(this ControlDataTab control, Action<DataServiceDescriptor> configure = null)
            where TEndpoint : IEndpoint
        {
            return AddPreset(control, DataServiceDescriptor.TabData, Endpoint<TEndpoint>(), configure);
        }

        /// <summary>
        /// Declares the standard data service of the kanban board, which loads
        /// its state with GET and persists it with PUT.
        /// </summary>
        /// <typeparam name="TEndpoint">The endpoint type that owns the route.</typeparam>
        /// <param name="control">The kanban control.</param>
        /// <param name="configure">An optional adjustment of the preset.</param>
        /// <returns>The control for chaining.</returns>
        public static ControlDataKanban DataService<TEndpoint>(this ControlDataKanban control, Action<DataServiceDescriptor> configure = null)
            where TEndpoint : IEndpoint
        {
            return AddPreset(control, DataServiceDescriptor.Data, Endpoint<TEndpoint>(), configure);
        }

        /// <summary>
        /// Declares the standard data service of the dashboard, which loads its
        /// state with GET and persists it with PUT.
        /// </summary>
        /// <typeparam name="TEndpoint">The endpoint type that owns the route.</typeparam>
        /// <param name="control">The dashboard control.</param>
        /// <param name="configure">An optional adjustment of the preset.</param>
        /// <returns>The control for chaining.</returns>
        public static ControlDataDashboard DataService<TEndpoint>(this ControlDataDashboard control, Action<DataServiceDescriptor> configure = null)
            where TEndpoint : IEndpoint
        {
            return AddPreset(control, DataServiceDescriptor.Data, Endpoint<TEndpoint>(), configure);
        }

        /// <summary>
        /// Declares the standard data service of the tile panel, which loads
        /// its state with GET and persists it with PUT.
        /// </summary>
        /// <typeparam name="TEndpoint">The endpoint type that owns the route.</typeparam>
        /// <param name="control">The tile control.</param>
        /// <param name="configure">An optional adjustment of the preset.</param>
        /// <returns>The control for chaining.</returns>
        public static ControlDataTile DataService<TEndpoint>(this ControlDataTile control, Action<DataServiceDescriptor> configure = null)
            where TEndpoint : IEndpoint
        {
            return AddPreset(control, DataServiceDescriptor.Data, Endpoint<TEndpoint>(), configure);
        }

        /// <summary>
        /// Declares the standard data service of the comment surface, which
        /// loads its state with GET and persists it with PUT.
        /// </summary>
        /// <typeparam name="TEndpoint">The endpoint type that owns the route.</typeparam>
        /// <param name="control">The comment control.</param>
        /// <param name="configure">An optional adjustment of the preset.</param>
        /// <returns>The control for chaining.</returns>
        public static ControlDataComment DataService<TEndpoint>(this ControlDataComment control, Action<DataServiceDescriptor> configure = null)
            where TEndpoint : IEndpoint
        {
            return AddPreset(control, DataServiceDescriptor.Data, Endpoint<TEndpoint>(), configure);
        }

        /// <summary>
        /// Declares the standard data service of the scrum backlog, which loads
        /// its state with GET and persists it with PUT.
        /// </summary>
        /// <typeparam name="TEndpoint">The endpoint type that owns the route.</typeparam>
        /// <param name="control">The scrum backlog control.</param>
        /// <param name="configure">An optional adjustment of the preset.</param>
        /// <returns>The control for chaining.</returns>
        public static ControlDataScrumBacklog DataService<TEndpoint>(this ControlDataScrumBacklog control, Action<DataServiceDescriptor> configure = null)
            where TEndpoint : IEndpoint
        {
            return AddPreset(control, DataServiceDescriptor.Data, Endpoint<TEndpoint>(), configure);
        }

        /// <summary>
        /// Declares the standard data service of the workflow editor, which
        /// loads its state with GET and persists it with PUT.
        /// </summary>
        /// <typeparam name="TEndpoint">The endpoint type that owns the route.</typeparam>
        /// <param name="control">The workflow control.</param>
        /// <param name="configure">An optional adjustment of the preset.</param>
        /// <returns>The control for chaining.</returns>
        public static ControlDataWorkflow DataService<TEndpoint>(this ControlDataWorkflow control, Action<DataServiceDescriptor> configure = null)
            where TEndpoint : IEndpoint
        {
            return AddPreset(control, DataServiceDescriptor.Data, Endpoint<TEndpoint>(), configure);
        }

        /// <summary>
        /// Builds the endpoint resolver for an endpoint type. The route is
        /// resolved through the sitemap at render time, so routing stays
        /// authoritative in C#.
        /// </summary>
        /// <typeparam name="TEndpoint">The endpoint type that owns the route.</typeparam>
        /// <returns>The resolver.</returns>
        private static Func<IRenderControlContext, string> Endpoint<TEndpoint>() where TEndpoint : IEndpoint
        {
            return renderContext => WebEx.ComponentHub.SitemapManager
                .GetUri<TEndpoint>(renderContext?.PageContext?.ApplicationContext)?.ToString();
        }

        /// <summary>
        /// Adds a preset service factory to the control.
        /// </summary>
        /// <typeparam name="T">The control type.</typeparam>
        /// <param name="control">The data bound control.</param>
        /// <param name="preset">The family preset, receiving the resolved endpoint.</param>
        /// <param name="endpoint">The endpoint resolver.</param>
        /// <param name="configure">An optional adjustment of the preset.</param>
        /// <returns>The control for chaining.</returns>
        private static T AddPreset<T>(T control, Func<string, DataServiceDescriptor> preset, Func<IRenderControlContext, string> endpoint, Action<DataServiceDescriptor> configure)
            where T : IDataIsland
        {
            control.ServiceFactories.Add(renderContext =>
            {
                var descriptor = preset(endpoint(renderContext));
                configure?.Invoke(descriptor);
                return descriptor;
            });

            return control;
        }
    }
}
