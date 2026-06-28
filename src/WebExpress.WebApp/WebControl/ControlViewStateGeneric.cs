using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using WebExpress.WebApp.WebData;
using WebExpress.WebCore.WebEndpoint;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// The type-safe scope ViewState host. Unlike the container form, it holds no
    /// child controls: it declares only the scope state, the scope services and
    /// the scope resources, all referenced by type rather than by string. The
    /// controls of the scope are created separately and bind to a resource with
    /// Resource&lt;TResource&gt;(); on the client they resolve the scope that
    /// declares the resource, so the host no longer needs to wrap them.
    ///
    /// <code>
    /// new ControlViewState&lt;DataQueryState&gt;("orders")
    ///     .State(s => { s.Page = 0; s.PageSize = 25; })
    ///     .Service&lt;OrderApi&gt;(svc => svc.Method(HttpMethod.Get))
    ///     .Resource&lt;OrdersResource&gt;(r => r.Service&lt;OrderApi&gt;().Param("page"));
    /// </code>
    ///
    /// See WebExpress/docs/view-state-service.md.
    /// </summary>
    /// <typeparam name="TState">The scope state model; its non null properties seed the state.</typeparam>
    public class ControlViewState<TState> : Control, IViewState where TState : class, new()
    {
        /// <summary>
        /// Gets the data service descriptors of the scope.
        /// </summary>
        public IList<Func<IRenderControlContext, DataServiceDescriptor>> ServiceFactories { get; } = [];

        /// <summary>
        /// Gets or sets the single data service descriptor, as a convenience.
        /// Reading returns the first declared service, assigning replaces all.
        /// </summary>
        public Func<IRenderControlContext, DataServiceDescriptor> ServiceFactory
        {
            get => ServiceFactories.Count > 0 ? ServiceFactories[0] : null;
            set
            {
                ServiceFactories.Clear();

                if (value != null)
                {
                    ServiceFactories.Add(value);
                }
            }
        }

        /// <summary>
        /// Gets or sets the optional template reference.
        /// </summary>
        public Func<IRenderControlContext, string> TemplateFactory { get; set; }

        /// <summary>
        /// Gets or sets the initial scope state, built from the typed state model.
        /// </summary>
        public Func<IRenderControlContext, DataState> StateFactory { get; set; }

        /// <summary>
        /// Gets the resource descriptors of the scope.
        /// </summary>
        public IList<Func<IRenderControlContext, DataResourceDescriptor>> ResourceFactories { get; } = [];

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The scope id, used as the data-wx-scope identifier.</param>
        public ControlViewState(string id = null)
            : base(id ?? RandomId.Create())
        {
        }

        /// <summary>
        /// Declares the initial scope state by configuring a typed state model.
        /// Each non null property of the model is emitted as a state value, so
        /// the seed is written through typed properties rather than string keys.
        /// </summary>
        /// <param name="configure">The state configuration.</param>
        /// <returns>The scope for chaining.</returns>
        public ControlViewState<TState> State(Action<TState> configure)
        {
            StateFactory = _ =>
            {
                var model = new TState();
                configure?.Invoke(model);
                return BuildState(model);
            };

            return this;
        }

        /// <summary>
        /// Declares a scope service, identified by its endpoint type rather than
        /// a string name. The endpoint is resolved through the sitemap at render
        /// time and the service name on the wire is derived from the type.
        /// </summary>
        /// <typeparam name="TEndpoint">The endpoint type of the service.</typeparam>
        /// <param name="configure">The service configuration.</param>
        /// <returns>The scope for chaining.</returns>
        public ControlViewState<TState> Service<TEndpoint>(Action<DataServiceBuilder> configure = null) where TEndpoint : IEndpoint
        {
            ServiceFactories.Add(renderContext =>
            {
                var builder = new DataServiceBuilder(DataTypeName.Of<TEndpoint>());
                builder.Endpoint<TEndpoint>();
                configure?.Invoke(builder);
                return builder.Build(renderContext);
            });

            return this;
        }

        /// <summary>
        /// Declares a scope resource, identified by its resource type rather than
        /// a string name. A control binds to it with Resource&lt;TResource&gt;().
        /// </summary>
        /// <typeparam name="TResource">The resource type.</typeparam>
        /// <param name="configure">The resource configuration.</param>
        /// <returns>The scope for chaining.</returns>
        public ControlViewState<TState> Resource<TResource>(Action<DataResourceBuilder> configure = null) where TResource : IDataResource
        {
            ResourceFactories.Add(_ =>
            {
                var builder = new DataResourceBuilder(DataTypeName.Of<TResource>());
                configure?.Invoke(builder);
                return builder.Build();
            });

            return this;
        }

        /// <summary>
        /// Converts the control to an HTML representation. It renders a hidden
        /// scope host that carries the state, service and resource islands; the
        /// host has no visible content because the scope declares no controls.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <param name="visualTree">The visual tree.</param>
        /// <returns>An HTML node representing the rendered control.</returns>
        public override IHtmlNode Render(IRenderControlContext renderContext, IVisualTreeControl visualTree)
        {
            var html = new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-viewstate", GetClasses(renderContext)),
                Style = GetStyles(renderContext)
            }
                .AddUserAttribute("data-wx-scope", Id);

            var resources = ResourceFactories
                .Select(factory => factory?.Invoke(renderContext))
                .Where(descriptor => descriptor != null)
                .ToArray();

            html.EmitDataIslands(this, renderContext)
                .EmitResourceIslands(resources);

            return html;
        }

        /// <summary>
        /// Builds the state island content from the typed state model by emitting
        /// each non null property as a state value under its camel cased name.
        /// </summary>
        /// <param name="model">The configured state model.</param>
        /// <returns>The state.</returns>
        private static DataState BuildState(TState model)
        {
            var state = DataState.Create();

            foreach (var property in typeof(TState).GetProperties(BindingFlags.Public | BindingFlags.Instance))
            {
                if (!property.CanRead || property.GetIndexParameters().Length > 0)
                {
                    continue;
                }

                var value = property.GetValue(model);
                if (value == null)
                {
                    continue;
                }

                state.Set(ToCamelCase(property.Name), value);
            }

            return state;
        }

        /// <summary>
        /// Lowercases the first letter of a property name, so a PascalCase state
        /// property maps to the camelCase state key the client engine expects.
        /// </summary>
        /// <param name="name">The property name.</param>
        /// <returns>The camel cased name.</returns>
        private static string ToCamelCase(string name)
        {
            if (string.IsNullOrEmpty(name) || char.IsLower(name[0]))
            {
                return name;
            }

            return char.ToLowerInvariant(name[0]) + name.Substring(1);
        }
    }
}
