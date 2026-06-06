using System;

namespace WebExpress.WebApp.WebData
{
    /// <summary>
    /// The fluent C# authoring surface of the data layer. These extensions let a
    /// control declare its initial state and its data service inline and by
    /// chaining, matching the View, State and Service concept, while the control
    /// keeps its existing base class (WebExpress.WebUI stays untouched). They are
    /// extension methods rather than control methods because the underlying
    /// <see cref="IDataIsland.StateFactory"/> and <see cref="IDataIsland.ServiceFactory"/>
    /// are the storage that the EmitDataIslands emission reads; the methods only
    /// populate them and return the control so the call site stays a single chain.
    /// </summary>
    public static class DataAuthoringExtensions
    {
        /// <summary>
        /// Declares the initial state of the control, emitted as the data-wx-state
        /// island. The configured state seeds the client store on the first render.
        /// </summary>
        /// <typeparam name="T">The control type.</typeparam>
        /// <param name="control">The data bound control.</param>
        /// <param name="configure">The state configuration.</param>
        /// <returns>The control for chaining.</returns>
        public static T State<T>(this T control, Action<DataState> configure) where T : IDataIsland
        {
            control.StateFactory = _ =>
            {
                var state = DataState.Create();
                configure?.Invoke(state);
                return state;
            };

            return control;
        }

        /// <summary>
        /// Declares a named data service of the control, emitted as the
        /// data-wx-service island. The endpoint is resolved through the sitemap at
        /// render time, so routing stays authoritative in C#.
        /// </summary>
        /// <typeparam name="T">The control type.</typeparam>
        /// <param name="control">The data bound control.</param>
        /// <param name="name">The logical service name, for example "data".</param>
        /// <param name="configure">The service configuration.</param>
        /// <returns>The control for chaining.</returns>
        public static T Service<T>(this T control, string name, Action<DataServiceBuilder> configure) where T : IDataIsland
        {
            control.ServiceFactory = renderContext =>
            {
                var builder = new DataServiceBuilder(name);
                configure?.Invoke(builder);
                return builder.Build(renderContext);
            };

            return control;
        }
    }
}
