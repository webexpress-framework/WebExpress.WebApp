using System.Collections.Generic;
using WebExpress.WebCore.WebHtml;

namespace WebExpress.WebApp.WebData
{
    /// <summary>
    /// A typed, C# authored description of a named resource of a ViewState.
    /// A resource binds a slice of the ViewState state to a named service: it names
    /// the service that loads it, the state key its result is reduced into and
    /// the parameters that flow between the state and the query. It renders into
    /// the hidden wx-resource island element that the JavaScript ViewState
    /// consumes, so the ViewState loads the resource centrally and every control that
    /// subscribes to the target slice re-renders when it changes.
    ///
    /// This is a C# artifact of the architecture described in
    /// WebExpress/docs/view-state-service.md. A control opts a region into the
    /// ViewState model by hosting it in a ControlViewState that declares the state,
    /// the services and these resources.
    /// </summary>
    public class DataResourceDescriptor
    {
        /// <summary>
        /// Gets the logical resource name, for example "orders". The ViewState
        /// loads and re-queries a resource by this name.
        /// </summary>
        public string Name { get; }

        /// <summary>
        /// Gets or sets the name of the ViewState service that loads the resource.
        /// </summary>
        public string Service { get; set; } = "data";

        /// <summary>
        /// Gets or sets the state key the projected result is reduced into, as
        /// state[target] = { items, total, loading, error }. Defaults to the
        /// resource name.
        /// </summary>
        public string Target { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether the ViewState loads the
        /// resource automatically on mount. A resource that loads on demand only
        /// sets this to false.
        /// </summary>
        public bool Auto { get; set; } = true;

        /// <summary>
        /// Gets the parameters of the resource. Each parameter binds a ViewState state
        /// key to a query parameter; the direction decides whether the value flows
        /// into the request, back from the response, or both.
        /// </summary>
        public IList<DataResourceParam> Params { get; } = new List<DataResourceParam>();

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="name">The logical resource name.</param>
        public DataResourceDescriptor(string name)
        {
            Name = name;
            Target = name;
        }

        /// <summary>
        /// Creates a resource descriptor with the given name.
        /// </summary>
        /// <param name="name">The logical resource name.</param>
        /// <returns>The descriptor for chaining.</returns>
        public static DataResourceDescriptor Create(string name)
        {
            return new DataResourceDescriptor(name);
        }

        /// <summary>
        /// Sets the name of the ViewState service that loads the resource.
        /// </summary>
        /// <param name="service">The service name.</param>
        /// <returns>The descriptor for chaining.</returns>
        public DataResourceDescriptor WithService(string service)
        {
            Service = service;
            return this;
        }

        /// <summary>
        /// Sets the state key the result is reduced into.
        /// </summary>
        /// <param name="target">The target state key.</param>
        /// <returns>The descriptor for chaining.</returns>
        public DataResourceDescriptor WithTarget(string target)
        {
            Target = target;
            return this;
        }

        /// <summary>
        /// Sets whether the resource loads automatically on mount.
        /// </summary>
        /// <param name="auto">Whether to load on mount.</param>
        /// <returns>The descriptor for chaining.</returns>
        public DataResourceDescriptor WithAuto(bool auto)
        {
            Auto = auto;
            return this;
        }

        /// <summary>
        /// Binds a ViewState state key to a query parameter. The direction defaults to
        /// a bidirectional binding, so the value feeds the request and the value
        /// the response echoes flows back into the state.
        /// </summary>
        /// <param name="name">The logical query parameter name.</param>
        /// <param name="state">The ViewState state key, defaulting to the parameter name.</param>
        /// <param name="dir">The binding direction, one of "in", "out" or "inout".</param>
        /// <returns>The descriptor for chaining.</returns>
        public DataResourceDescriptor MapParam(string name, string state = null, string dir = "inout")
        {
            Params.Add(new DataResourceParam(name, state ?? name, dir));
            return this;
        }

        /// <summary>
        /// Renders the descriptor into the hidden wx-resource island element that
        /// the JavaScript ViewState consumes. The scalar parts become attributes
        /// and the parameter bindings become wx-param child elements. The auto
        /// attribute is emitted only to opt out, mirroring the client default that
        /// a resource loads automatically unless told otherwise.
        /// </summary>
        /// <returns>The island element.</returns>
        public HtmlElement ToIslandElement()
        {
            var island = new HtmlElement("wx-resource");
            island.AddUserAttribute("hidden");
            island.AddUserAttribute("name", Name);
            island.AddUserAttribute("service", string.IsNullOrEmpty(Service) ? "data" : Service);
            island.AddUserAttribute("target", string.IsNullOrEmpty(Target) ? Name : Target);

            if (!Auto)
            {
                island.AddUserAttribute("auto", "false");
            }

            foreach (var param in Params)
            {
                var child = new HtmlElement("wx-param");
                child.AddUserAttribute("name", param.Name);
                child.AddUserAttribute("state", param.State);
                child.AddUserAttribute("dir", string.IsNullOrEmpty(param.Dir) ? "inout" : param.Dir);
                island.Add(child);
            }

            return island;
        }
    }

    /// <summary>
    /// A single bidirectional binding between a ViewState state key and a query
    /// parameter of a resource. The direction "out" feeds the request from the
    /// state, "in" writes the value the response echoes back into the state, and
    /// "inout" does both.
    /// </summary>
    public class DataResourceParam
    {
        /// <summary>
        /// Gets the logical query parameter name.
        /// </summary>
        public string Name { get; }

        /// <summary>
        /// Gets the ViewState state key the parameter binds to.
        /// </summary>
        public string State { get; }

        /// <summary>
        /// Gets the binding direction, one of "in", "out" or "inout".
        /// </summary>
        public string Dir { get; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="name">The logical query parameter name.</param>
        /// <param name="state">The ViewState state key.</param>
        /// <param name="dir">The binding direction.</param>
        public DataResourceParam(string name, string state, string dir)
        {
            Name = name;
            State = state;
            Dir = dir;
        }
    }
}
