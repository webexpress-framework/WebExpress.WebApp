using System;

namespace WebExpress.WebApp.WebData
{
    /// <summary>
    /// The fluent C# authoring surface of the data layer. These extensions let a
    /// control declare its initial state, its data services and its template
    /// inline and by chaining, matching the View, State and Service concept,
    /// while the control keeps its existing base class (WebExpress.WebUI stays
    /// untouched). They are extension methods rather than control methods because
    /// the underlying <see cref="IDataIsland.StateFactory"/>,
    /// <see cref="IDataIsland.ServiceFactories"/> and
    /// <see cref="IDataIsland.TemplateFactory"/> are the storage that the
    /// EmitDataIslands emission reads; the methods only populate them and return
    /// the control so the call site stays a single chain.
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
        /// Declares a named data service of the control, emitted as part of the
        /// data-wx-service island. The endpoint is resolved through the sitemap at
        /// render time, so routing stays authoritative in C#. A control may
        /// declare several services, for example a load and a submit service,
        /// each call adds one service to the island.
        /// </summary>
        /// <typeparam name="T">The control type.</typeparam>
        /// <param name="control">The data bound control.</param>
        /// <param name="name">The logical service name, for example "data".</param>
        /// <param name="configure">The service configuration.</param>
        /// <returns>The control for chaining.</returns>
        public static T Service<T>(this T control, string name, Action<DataServiceBuilder> configure) where T : IDataIsland
        {
            control.ServiceFactories.Add(renderContext =>
            {
                var builder = new DataServiceBuilder(name);
                configure?.Invoke(builder);
                return builder.Build(renderContext);
            });

            return control;
        }

        /// <summary>
        /// Declares the template reference of the control, emitted as the
        /// data-wx-template attribute. The client Templates registry resolves it
        /// into a registered render function or a server rendered template
        /// element.
        /// </summary>
        /// <typeparam name="T">The control type.</typeparam>
        /// <param name="control">The data bound control.</param>
        /// <param name="templateId">The template identifier.</param>
        /// <returns>The control for chaining.</returns>
        public static T Template<T>(this T control, string templateId) where T : IDataIsland
        {
            control.TemplateFactory = _ => templateId;
            return control;
        }
    }
}
