using System;

namespace WebExpress.WebApp.WebData
{
    /// <summary>
    /// The fluent C# authoring surface for the resources of a scope ViewState.
    /// It complements the state and service authoring of
    /// <see cref="DataAuthoringExtensions"/> with the resource declaration, so a
    /// scope is authored as one chain of State, Service and Resource calls. The
    /// method is an extension rather than a control method because the underlying
    /// <see cref="IViewState.ResourceFactories"/> is the storage the emission
    /// reads; the method only populates it and returns the control so the call
    /// site stays a single chain.
    /// </summary>
    public static class ViewStateAuthoringExtensions
    {
        /// <summary>
        /// Declares a named resource of the scope, emitted as a wx-resource island.
        /// The resource binds the scope state to a scope service, so the ViewState
        /// loads it centrally and re-queries it when a control changes the state it
        /// depends on. Each call adds one resource.
        /// </summary>
        /// <typeparam name="T">The scope host control type.</typeparam>
        /// <param name="control">The scope host control.</param>
        /// <param name="name">The logical resource name, for example "orders".</param>
        /// <param name="configure">The resource configuration.</param>
        /// <returns>The control for chaining.</returns>
        public static T Resource<T>(this T control, string name, Action<DataResourceBuilder> configure) where T : IViewState
        {
            control.ResourceFactories.Add(_ =>
            {
                var builder = new DataResourceBuilder(name);
                configure?.Invoke(builder);
                return builder.Build();
            });

            return control;
        }
    }
}
