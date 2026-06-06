using System;
using System.Collections.Generic;
using System.Net.Http;
using WebExpress.WebCore;
using WebExpress.WebCore.WebEndpoint;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebData
{
    /// <summary>
    /// A fluent builder for a named data service. It is the C# authoring surface
    /// of the View, State and Service concept: the endpoint is declared once
    /// through <see cref="Endpoint{TEndpoint}"/> and resolved through the sitemap
    /// at render time, so routing stays authoritative in C# and no endpoint string
    /// is repeated. The builder produces a <see cref="DataServiceDescriptor"/> that
    /// the control serializes into the data-wx-service island.
    /// </summary>
    public class DataServiceBuilder
    {
        private readonly string _name;
        private Func<IRenderControlContext, string> _endpoint;
        private string _method;
        private string _updateMethod;
        private readonly List<KeyValuePair<string, string>> _query = new();
        private readonly List<KeyValuePair<string, string>> _response = new();

        /// <summary>
        /// Initializes a new instance for the named service.
        /// </summary>
        /// <param name="name">The logical service name, for example "data".</param>
        public DataServiceBuilder(string name)
        {
            _name = name;
        }

        /// <summary>
        /// Declares the service endpoint by its endpoint type. The route is
        /// resolved through the sitemap at render time, so routing stays in C# and
        /// the page does not repeat the endpoint.
        /// </summary>
        /// <typeparam name="TEndpoint">The endpoint type that owns the route.</typeparam>
        /// <returns>The builder for chaining.</returns>
        public DataServiceBuilder Endpoint<TEndpoint>() where TEndpoint : IEndpoint
        {
            _endpoint = renderContext => WebEx.ComponentHub.SitemapManager
                .GetUri<TEndpoint>(renderContext?.PageContext?.ApplicationContext)?.ToString();
            return this;
        }

        /// <summary>
        /// Sets the HTTP method used for the load and query operations.
        /// </summary>
        /// <param name="method">The HTTP method, for example GET.</param>
        /// <returns>The builder for chaining.</returns>
        public DataServiceBuilder Method(HttpMethod method)
        {
            _method = method?.Method;
            return this;
        }

        /// <summary>
        /// Sets the HTTP method used for the update operation.
        /// </summary>
        /// <param name="method">The HTTP method, for example PUT.</param>
        /// <returns>The builder for chaining.</returns>
        public DataServiceBuilder UpdateMethod(HttpMethod method)
        {
            _updateMethod = method?.Method;
            return this;
        }

        /// <summary>
        /// Maps logical query parameter names to their wire names.
        /// </summary>
        /// <param name="configure">The query map configuration.</param>
        /// <returns>The builder for chaining.</returns>
        public DataServiceBuilder Query(Action<DataQueryMap> configure)
        {
            var map = new DataQueryMap();
            configure?.Invoke(map);
            _query.AddRange(map.Pairs);
            return this;
        }

        /// <summary>
        /// Maps logical response keys to their wire names.
        /// </summary>
        /// <param name="configure">The response map configuration.</param>
        /// <returns>The builder for chaining.</returns>
        public DataServiceBuilder Response(Action<DataResponseMap> configure)
        {
            var map = new DataResponseMap();
            configure?.Invoke(map);
            _response.AddRange(map.Pairs);
            return this;
        }

        /// <summary>
        /// Builds the descriptor, resolving the endpoint in the given render context.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <returns>The configured descriptor.</returns>
        public DataServiceDescriptor Build(IRenderControlContext renderContext)
        {
            var descriptor = DataServiceDescriptor.Rest(_name)
                .WithBaseUri(_endpoint?.Invoke(renderContext));

            if (_method != null)
            {
                descriptor = descriptor.WithMethod(_method);
            }

            if (_updateMethod != null)
            {
                descriptor = descriptor.WithUpdateMethod(_updateMethod);
            }

            foreach (var pair in _query)
            {
                descriptor = descriptor.MapQuery(pair.Key, pair.Value);
            }

            foreach (var pair in _response)
            {
                descriptor = descriptor.MapResponse(pair.Key, pair.Value);
            }

            return descriptor;
        }
    }

    /// <summary>
    /// Collects the mapping of logical query parameter names to their wire names,
    /// for the fluent <see cref="DataServiceBuilder.Query"/> surface.
    /// </summary>
    public class DataQueryMap
    {
        internal List<KeyValuePair<string, string>> Pairs { get; } = new();

        /// <summary>
        /// Maps a logical query parameter name to its wire name.
        /// </summary>
        /// <param name="logical">The logical name, for example "search".</param>
        /// <param name="wire">The wire name, for example "q".</param>
        /// <returns>The map for chaining.</returns>
        public DataQueryMap Map(string logical, string wire)
        {
            Pairs.Add(new KeyValuePair<string, string>(logical, wire));
            return this;
        }
    }

    /// <summary>
    /// Collects the mapping of logical response keys to their wire names, for the
    /// fluent <see cref="DataServiceBuilder.Response"/> surface.
    /// </summary>
    public class DataResponseMap
    {
        internal List<KeyValuePair<string, string>> Pairs { get; } = new();

        /// <summary>
        /// Maps a logical response key to its wire name.
        /// </summary>
        /// <param name="logical">The logical key, for example "items".</param>
        /// <param name="wire">The wire name.</param>
        /// <returns>The map for chaining.</returns>
        public DataResponseMap Map(string logical, string wire)
        {
            Pairs.Add(new KeyValuePair<string, string>(logical, wire));
            return this;
        }

        /// <summary>
        /// Maps the items collection of the response.
        /// </summary>
        /// <param name="wire">The wire name, default "items".</param>
        /// <returns>The map for chaining.</returns>
        public DataResponseMap Items(string wire = "items") => Map("items", wire);

        /// <summary>
        /// Maps the rows collection of the response.
        /// </summary>
        /// <param name="wire">The wire name, default "rows".</param>
        /// <returns>The map for chaining.</returns>
        public DataResponseMap Rows(string wire = "rows") => Map("rows", wire);

        /// <summary>
        /// Maps the total count of the response.
        /// </summary>
        /// <param name="wire">The wire name, default "total".</param>
        /// <returns>The map for chaining.</returns>
        public DataResponseMap Total(string wire = "total") => Map("total", wire);
    }
}
