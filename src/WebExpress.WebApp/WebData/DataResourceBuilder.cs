using System.Collections.Generic;

namespace WebExpress.WebApp.WebData
{
    /// <summary>
    /// A fluent builder for a named resource of a scope ViewState. It is the C#
    /// authoring surface that declares which scope service loads the resource,
    /// which state key receives the result and how the parameters flow between
    /// the state and the query. The builder produces a
    /// <see cref="DataResourceDescriptor"/> that the ControlViewState serializes
    /// into the wx-resource island.
    /// </summary>
    public class DataResourceBuilder
    {
        private readonly string _name;
        private string _service = "data";
        private string _target;
        private bool _auto = true;
        private readonly List<DataResourceParam> _params = new();

        /// <summary>
        /// Initializes a new instance for the named resource.
        /// </summary>
        /// <param name="name">The logical resource name, for example "orders".</param>
        public DataResourceBuilder(string name)
        {
            _name = name;
        }

        /// <summary>
        /// Sets the name of the scope service that loads the resource.
        /// </summary>
        /// <param name="name">The service name, default "data".</param>
        /// <returns>The builder for chaining.</returns>
        public DataResourceBuilder Service(string name)
        {
            _service = name;
            return this;
        }

        /// <summary>
        /// Sets the state key the projected result is reduced into. Defaults to
        /// the resource name.
        /// </summary>
        /// <param name="target">The target state key.</param>
        /// <returns>The builder for chaining.</returns>
        public DataResourceBuilder Target(string target)
        {
            _target = target;
            return this;
        }

        /// <summary>
        /// Sets whether the resource loads automatically on mount.
        /// </summary>
        /// <param name="auto">Whether to load on mount.</param>
        /// <returns>The builder for chaining.</returns>
        public DataResourceBuilder Auto(bool auto)
        {
            _auto = auto;
            return this;
        }

        /// <summary>
        /// Binds a scope state key to a query parameter. The direction defaults to
        /// a bidirectional binding, so the value feeds the request and the value
        /// the response echoes flows back into the state.
        /// </summary>
        /// <param name="name">The logical query parameter name.</param>
        /// <param name="state">The scope state key, defaulting to the parameter name.</param>
        /// <param name="dir">The binding direction, one of "in", "out" or "inout".</param>
        /// <returns>The builder for chaining.</returns>
        public DataResourceBuilder Param(string name, string state = null, string dir = "inout")
        {
            _params.Add(new DataResourceParam(name, state ?? name, dir));
            return this;
        }

        /// <summary>
        /// Builds the descriptor.
        /// </summary>
        /// <returns>The configured descriptor.</returns>
        public DataResourceDescriptor Build()
        {
            var descriptor = DataResourceDescriptor.Create(_name)
                .WithService(_service)
                .WithAuto(_auto);

            if (_target != null)
            {
                descriptor = descriptor.WithTarget(_target);
            }

            foreach (var param in _params)
            {
                descriptor = descriptor.MapParam(param.Name, param.State, param.Dir);
            }

            return descriptor;
        }
    }
}
