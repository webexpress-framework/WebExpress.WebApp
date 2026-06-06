using System.Collections.Generic;
using System.Text.Json;

namespace WebExpress.WebApp.WebData
{
    /// <summary>
    /// A typed, C# authored description of a named REST service for a View, State
    /// and Service component. The descriptor is the single source of truth for
    /// endpoint knowledge: it carries the service name, the base address, the
    /// HTTP methods and the mapping of logical query and response names to their
    /// wire names. It serializes into the compact data-wx-service JSON island
    /// that the JavaScript ServiceRegistry consumes, so the client carries no
    /// hard-coded endpoint or parameter knowledge.
    ///
    /// This is a C# artifact of the architecture described in
    /// WebExpress/docs/view-state-service.md (section 3.2). Controls opt into the
    /// emission by implementing IDataIsland and calling EmitDataIslands, which
    /// turns the declared service and state into the data-wx-service and
    /// data-wx-state islands beside the legacy attributes.
    /// </summary>
    public class DataServiceDescriptor
    {
        private static readonly JsonSerializerOptions IslandOptions = new()
        {
            WriteIndented = false
        };

        /// <summary>
        /// Gets the logical service name, for example "data". The component
        /// resolves a service from the island by this name.
        /// </summary>
        public string Name { get; }

        /// <summary>
        /// Gets or sets the service kind. The only kind the default engine knows
        /// is "rest".
        /// </summary>
        public string Kind { get; set; } = "rest";

        /// <summary>
        /// Gets or sets the base address the service calls. The route is resolved
        /// through the sitemap in C#, so routing stays authoritative on the server.
        /// </summary>
        public string BaseUri { get; set; }

        /// <summary>
        /// Gets or sets the HTTP method used for the load and query operations.
        /// </summary>
        public string Method { get; set; }

        /// <summary>
        /// Gets or sets the HTTP method used for the update operation, for
        /// example "PUT" or "PATCH".
        /// </summary>
        public string UpdateMethod { get; set; }

        /// <summary>
        /// Gets the mapping of logical query parameter names to their wire names,
        /// for example "search" to "q".
        /// </summary>
        public IDictionary<string, string> Query { get; } = new Dictionary<string, string>();

        /// <summary>
        /// Gets the mapping of logical response keys to their wire names, for
        /// example "items" to "items" and "total" to "total".
        /// </summary>
        public IDictionary<string, string> Response { get; } = new Dictionary<string, string>();

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="name">The logical service name.</param>
        public DataServiceDescriptor(string name)
        {
            Name = name;
        }

        /// <summary>
        /// Creates a rest service descriptor with the given name.
        /// </summary>
        /// <param name="name">The logical service name.</param>
        /// <returns>The descriptor for chaining.</returns>
        public static DataServiceDescriptor Rest(string name)
        {
            return new DataServiceDescriptor(name) { Kind = "rest" };
        }

        /// <summary>
        /// Creates the data service descriptor for the REST list control. It
        /// reproduces the historical query parameter and response names of the
        /// list, which is the same shape that the JavaScript legacyDescriptor
        /// fallback carries, so the island and the fallback are equivalent.
        /// </summary>
        /// <param name="baseUri">The resolved list endpoint.</param>
        /// <returns>The configured descriptor.</returns>
        public static DataServiceDescriptor ListData(string baseUri)
        {
            return Rest("data")
                .WithBaseUri(baseUri)
                .WithMethod("GET")
                .MapQuery("search", "q")
                .MapQuery("wql", "wql")
                .MapQuery("filter", "f")
                .MapQuery("page", "p")
                .MapQuery("pageSize", "l")
                .MapQuery("orderBy", "o")
                .MapQuery("orderDir", "d")
                .MapResponse("items", "items")
                .MapResponse("total", "total");
        }

        /// <summary>
        /// Creates the common data service descriptor for a control that loads
        /// its state with GET and persists it with PUT and carries no query or
        /// response mapping. This is the shape that the kanban, tile, dashboard,
        /// comment, scrum backlog and workflow controls share through their
        /// JavaScript legacyDescriptor.
        /// </summary>
        /// <param name="baseUri">The resolved endpoint.</param>
        /// <returns>The configured descriptor.</returns>
        public static DataServiceDescriptor Data(string baseUri)
        {
            return Rest("data")
                .WithBaseUri(baseUri)
                .WithMethod("GET")
                .WithUpdateMethod("PUT");
        }

        /// <summary>
        /// Creates the data service descriptor for the REST tab control. It loads
        /// with GET and persists with PUT, maps the logical id parameter and
        /// projects the items response, which mirrors
        /// webexpress.webapp.tabModel.legacyDescriptor.
        /// </summary>
        /// <param name="baseUri">The resolved tab endpoint.</param>
        /// <returns>The configured descriptor.</returns>
        public static DataServiceDescriptor TabData(string baseUri)
        {
            return Rest("data")
                .WithBaseUri(baseUri)
                .WithMethod("GET")
                .WithUpdateMethod("PUT")
                .MapQuery("id", "id")
                .MapResponse("items", "items");
        }

        /// <summary>
        /// Creates the data service descriptor for the REST table control. It
        /// reproduces the historical query parameter and response names of the
        /// table, which is the same shape that the JavaScript legacyDescriptor
        /// fallback carries. The table differs from the list in that it persists
        /// a reordered row set with a PUT update and projects rows rather than
        /// items.
        /// </summary>
        /// <param name="baseUri">The resolved table endpoint.</param>
        /// <returns>The configured descriptor.</returns>
        public static DataServiceDescriptor TableData(string baseUri)
        {
            return Rest("data")
                .WithBaseUri(baseUri)
                .WithMethod("GET")
                .WithUpdateMethod("PUT")
                .MapQuery("search", "q")
                .MapQuery("wql", "wql")
                .MapQuery("filter", "f")
                .MapQuery("page", "p")
                .MapQuery("pageSize", "l")
                .MapQuery("orderBy", "o")
                .MapQuery("orderDir", "d")
                .MapResponse("rows", "rows")
                .MapResponse("total", "total");
        }

        /// <summary>
        /// Sets the base address.
        /// </summary>
        /// <param name="baseUri">The base address.</param>
        /// <returns>The descriptor for chaining.</returns>
        public DataServiceDescriptor WithBaseUri(string baseUri)
        {
            BaseUri = baseUri;
            return this;
        }

        /// <summary>
        /// Sets the load and query method.
        /// </summary>
        /// <param name="method">The HTTP method.</param>
        /// <returns>The descriptor for chaining.</returns>
        public DataServiceDescriptor WithMethod(string method)
        {
            Method = method;
            return this;
        }

        /// <summary>
        /// Sets the update method.
        /// </summary>
        /// <param name="method">The HTTP method.</param>
        /// <returns>The descriptor for chaining.</returns>
        public DataServiceDescriptor WithUpdateMethod(string method)
        {
            UpdateMethod = method;
            return this;
        }

        /// <summary>
        /// Maps a logical query parameter name to its wire name.
        /// </summary>
        /// <param name="logical">The logical name.</param>
        /// <param name="wire">The wire name.</param>
        /// <returns>The descriptor for chaining.</returns>
        public DataServiceDescriptor MapQuery(string logical, string wire)
        {
            Query[logical] = wire;
            return this;
        }

        /// <summary>
        /// Maps a logical response key to its wire name.
        /// </summary>
        /// <param name="logical">The logical key.</param>
        /// <param name="wire">The wire name.</param>
        /// <returns>The descriptor for chaining.</returns>
        public DataServiceDescriptor MapResponse(string logical, string wire)
        {
            Response[logical] = wire;
            return this;
        }

        /// <summary>
        /// Serializes the descriptor into the compact JSON island that the
        /// JavaScript ServiceRegistry consumes. Empty parts are omitted so the
        /// island stays small. The caller is responsible for HTML attribute
        /// encoding when the result is written into a data-wx-service attribute.
        /// </summary>
        /// <returns>The compact JSON representation.</returns>
        public string ToIsland()
        {
            var map = new Dictionary<string, object>
            {
                ["name"] = Name,
                ["kind"] = string.IsNullOrEmpty(Kind) ? "rest" : Kind,
                ["baseUri"] = BaseUri ?? string.Empty
            };

            if (!string.IsNullOrEmpty(Method))
            {
                map["method"] = Method;
            }

            if (!string.IsNullOrEmpty(UpdateMethod))
            {
                map["updateMethod"] = UpdateMethod;
            }

            if (Query.Count > 0)
            {
                map["query"] = Query;
            }

            if (Response.Count > 0)
            {
                map["response"] = Response;
            }

            return JsonSerializer.Serialize(map, IslandOptions);
        }
    }
}
