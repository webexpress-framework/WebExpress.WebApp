using System;
using System.Collections.Generic;
using System.Globalization;
using System.Net;
using System.Text.RegularExpressions;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebMessage;

namespace WebExpress.WebApp.WebData
{
    /// <summary>
    /// A typed, C# authored description of a named REST service for a View, State
    /// and Service component. The descriptor is the single source of truth for
    /// endpoint knowledge: it carries the service name, the base address, the
    /// HTTP methods and the mapping of logical query and response names to their
    /// wire names. It renders into the hidden wx-service island element that the
    /// JavaScript ServiceRegistry consumes, so the client carries no hard-coded
    /// endpoint or parameter knowledge.
    ///
    /// This is a C# artifact of the architecture described in
    /// WebExpress/docs/view-state-service.md (section 3.2). Controls opt into the
    /// emission by implementing IDataIsland and calling EmitDataIslands, which
    /// turns the declared services and state into wx-service and wx-state island
    /// elements at the start of the host element.
    /// </summary>
    public class DataServiceDescriptor
    {
        /// <summary>
        /// Matches a ${name} path variable placeholder that the sitemap leaves in
        /// a resolved base address when the endpoint route carries a path
        /// parameter without a bound value (see
        /// UriPathSegmentVariable.ToString). The captured group is the variable
        /// name, which is also the request parameter key that fills it.
        /// </summary>
        private static readonly Regex PathVariablePlaceholder = new(@"\$\{([^{}]+)\}", RegexOptions.Compiled);

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
        /// Gets the additional request headers the service sends, for example an
        /// api version header. The Accept and Content-Type headers are managed
        /// by the client service itself.
        /// </summary>
        public IDictionary<string, string> Headers { get; } = new Dictionary<string, string>();

        /// <summary>
        /// Gets the mapping of http status codes to message keys, for example
        /// 404 to "webexpress.webapp:error.notfound". The client service surfaces
        /// the mapped message in its normalized error, so the messages stay
        /// server-authored and localizable.
        /// </summary>
        public IDictionary<string, string> Errors { get; } = new Dictionary<string, string>();

        /// <summary>
        /// Gets the wire names of the logical domains whose data the service
        /// serves. A ViewState subscribes these domains on the message
        /// queue and re-queries the resources of this service when the server
        /// announces a change, so data changed by other users re-renders
        /// without a page reload. The names are usually derived from the
        /// endpoint type, so the author never writes them.
        /// </summary>
        public IList<string> Domains { get; } = new List<string>();

        /// <summary>
        /// Gets or sets the number of automatic retries the client service
        /// performs for retriable failures, which are network errors and http
        /// 5xx responses. The default of zero disables retrying.
        /// </summary>
        public int RetryCount { get; set; }

        /// <summary>
        /// Gets or sets the delay in milliseconds between automatic retries.
        /// </summary>
        public int RetryDelayMilliseconds { get; set; }

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
        /// Creates the data service descriptor for the service level agreement.
        /// It loads the state with GET and requests a transition with POST,
        /// because a pause or a settlement is an action the endpoint applies to
        /// the agreement rather than a new representation the client dictates.
        /// </summary>
        /// <param name="baseUri">The resolved endpoint.</param>
        /// <returns>The configured descriptor.</returns>
        public static DataServiceDescriptor SlaData(string baseUri)
        {
            return Rest("data")
                .WithBaseUri(baseUri)
                .WithMethod("GET")
                .WithUpdateMethod("POST");
        }

        /// <summary>
        /// Creates the data service descriptor for the schedule. It loads the
        /// items of a period with GET and persists their mutations against the
        /// same base - POST to create, PUT to update, DELETE to remove. The
        /// period travels as the from and to parameters, because a calendar is
        /// queried by the range it shows rather than by a page number.
        /// </summary>
        /// <param name="baseUri">The resolved endpoint.</param>
        /// <returns>The configured descriptor.</returns>
        public static DataServiceDescriptor ScheduleData(string baseUri)
        {
            return Rest("data")
                .WithBaseUri(baseUri)
                .WithMethod("GET")
                .WithUpdateMethod("PUT")
                .MapQuery("from", "from")
                .MapQuery("to", "to");
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
        /// Creates the data service descriptor for a control that only queries
        /// its endpoint with GET, which is the shape the dropdowns, the inputs,
        /// the quickfilter, the search surfaces, the tag, the watcher and the
        /// scrum sprint share.
        /// </summary>
        /// <param name="baseUri">The resolved endpoint.</param>
        /// <returns>The configured descriptor.</returns>
        public static DataServiceDescriptor QueryData(string baseUri)
        {
            return Rest("data")
                .WithBaseUri(baseUri)
                .WithMethod("GET");
        }

        /// <summary>
        /// Creates the data service descriptor for a control that submits to its
        /// endpoint with POST, which is the shape the login form uses.
        /// </summary>
        /// <param name="baseUri">The resolved endpoint.</param>
        /// <returns>The configured descriptor.</returns>
        public static DataServiceDescriptor SubmitData(string baseUri)
        {
            return Rest("data")
                .WithBaseUri(baseUri)
                .WithMethod("POST");
        }

        /// <summary>
        /// Creates the data service descriptor for a form surface, which shapes
        /// its own requests against the base address (load url, submit method
        /// and body are built per request), so the descriptor carries only the
        /// endpoint.
        /// </summary>
        /// <param name="baseUri">The resolved endpoint.</param>
        /// <returns>The configured descriptor.</returns>
        public static DataServiceDescriptor FormData(string baseUri)
        {
            return Rest("data")
                .WithBaseUri(baseUri);
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
        /// Adds a request header the service sends with every call.
        /// </summary>
        /// <param name="name">The header name.</param>
        /// <param name="value">The header value.</param>
        /// <returns>The descriptor for chaining.</returns>
        public DataServiceDescriptor WithHeader(string name, string value)
        {
            Headers[name] = value;
            return this;
        }

        /// <summary>
        /// Maps an http status code to a message key, so the failure message
        /// stays server-authored and localizable.
        /// </summary>
        /// <param name="status">The http status code.</param>
        /// <param name="message">The message or message key.</param>
        /// <returns>The descriptor for chaining.</returns>
        public DataServiceDescriptor MapError(int status, string message)
        {
            Errors[status.ToString()] = message;
            return this;
        }

        /// <summary>
        /// Adds a domain the service serves data of, identified by its wire
        /// name. Duplicates are ignored so the derived and the explicitly
        /// declared domains merge cleanly.
        /// </summary>
        /// <param name="domain">The wire name of the domain.</param>
        /// <returns>The descriptor for chaining.</returns>
        public DataServiceDescriptor WithDomain(string domain)
        {
            if (!string.IsNullOrWhiteSpace(domain) && !Domains.Contains(domain))
            {
                Domains.Add(domain);
            }

            return this;
        }

        /// <summary>
        /// Declares the retry policy for retriable failures, which are network
        /// errors and http 5xx responses.
        /// </summary>
        /// <param name="count">The number of automatic retries.</param>
        /// <param name="delayMilliseconds">The delay between retries.</param>
        /// <returns>The descriptor for chaining.</returns>
        public DataServiceDescriptor WithRetry(int count, int delayMilliseconds = 0)
        {
            RetryCount = count;
            RetryDelayMilliseconds = delayMilliseconds;
            return this;
        }

        /// <summary>
        /// Expands the ${name} path variable placeholders the sitemap leaves in
        /// the base address when the endpoint route carries a path parameter
        /// without a bound value, so a service whose endpoint is keyed by a route
        /// parameter (for example /api/1/fields/${classid}/table) points at the
        /// concrete resource of the current request rather than at a literal
        /// placeholder the client cannot resolve. Each placeholder is replaced
        /// with the value of the request parameter of the same name; the lookup
        /// is case insensitive, because the placeholder carries the segment's
        /// variable name while the request stores the route parameter key in
        /// lower case. A placeholder without a matching request parameter is left
        /// untouched, so a genuine misconfiguration stays visible instead of
        /// silently producing a wrong url, and a value the client is expected to
        /// fill per call is preserved. This is the automatic binding the emission
        /// applies from the current request; the manual overloads bind values the
        /// request does not carry.
        /// </summary>
        /// <param name="request">The current request whose route parameters bind the placeholders.</param>
        /// <returns>The descriptor for chaining.</returns>
        public DataServiceDescriptor BindPathVariables(IRequest request)
        {
            return request == null
                ? this
                : ExpandPathVariables(name => request.GetParameter(name)?.Value);
        }

        /// <summary>
        /// Binds a single ${name} path variable placeholder to an explicit value,
        /// for a service endpoint whose route parameter the current request does
        /// not carry, for example a value the author knows at render time or a
        /// value bound under a different name than the placeholder. A manual
        /// binding runs before the automatic request binding of the emission and
        /// removes the placeholder it fills, so it takes precedence over a request
        /// parameter of the same name, and it leaves other placeholders for the
        /// request or the client. The lookup is case insensitive, matching the
        /// request binding.
        /// </summary>
        /// <param name="name">The placeholder name, which is the route parameter's variable name.</param>
        /// <param name="value">The explicit value the placeholder is replaced with.</param>
        /// <returns>The descriptor for chaining.</returns>
        public DataServiceDescriptor BindPathVariable(string name, string value)
        {
            return string.IsNullOrEmpty(name)
                ? this
                : ExpandPathVariables(candidate => string.Equals(candidate, name, StringComparison.OrdinalIgnoreCase) ? value : null);
        }

        /// <summary>
        /// Binds several ${name} path variable placeholders to explicit values in
        /// one pass, for a service endpoint whose route parameters the current
        /// request does not carry. The values are matched by name, case
        /// insensitively, and a placeholder with no matching entry is left for the
        /// request or the client, so a partial manual binding composes with the
        /// automatic request binding of the emission.
        /// </summary>
        /// <param name="values">The explicit placeholder name to value bindings.</param>
        /// <returns>The descriptor for chaining.</returns>
        public DataServiceDescriptor BindPathVariables(IEnumerable<KeyValuePair<string, string>> values)
        {
            if (values == null)
            {
                return this;
            }

            var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (var pair in values)
            {
                map[pair.Key] = pair.Value;
            }

            return ExpandPathVariables(name => map.TryGetValue(name, out var value) ? value : null);
        }

        /// <summary>
        /// Replaces the ${name} placeholders of the base address with the values
        /// the resolver returns, leaving a placeholder untouched when the resolver
        /// yields null. It is the shared core of the request and manual bindings,
        /// so both apply the same placeholder grammar and the same leave-on-miss
        /// rule.
        /// </summary>
        /// <param name="resolve">Maps a placeholder name to its value, or null to leave it in place.</param>
        /// <returns>The descriptor for chaining.</returns>
        private DataServiceDescriptor ExpandPathVariables(Func<string, string> resolve)
        {
            // the common static endpoint carries no placeholder, so the guard
            // keeps the regex off the render hot path in that case
            if (string.IsNullOrEmpty(BaseUri) || !BaseUri.Contains("${"))
            {
                return this;
            }

            BaseUri = PathVariablePlaceholder.Replace(BaseUri, match =>
            {
                var value = resolve(match.Groups[1].Value);
                return value ?? match.Value;
            });

            return this;
        }

        /// <summary>
        /// Renders the descriptor into the hidden wx-service island element that
        /// the JavaScript ServiceRegistry consumes. The scalar parts become
        /// attributes, the query, response, header and error mappings become
        /// child elements, and empty parts are omitted so the island stays small.
        /// </summary>
        /// <returns>The island element.</returns>
        public HtmlElement ToIslandElement()
        {
            var island = new HtmlElement("wx-service");
            island.AddUserAttribute("hidden");
            island.AddUserAttribute("name", Encode(Name));
            island.AddUserAttribute("kind", Encode(string.IsNullOrEmpty(Kind) ? "rest" : Kind));
            island.AddUserAttribute("base-uri", Encode(BaseUri));
            island.AddUserAttribute("method", Encode(Method));
            island.AddUserAttribute("update-method", Encode(UpdateMethod));

            if (Domains.Count > 0)
            {
                island.AddUserAttribute("domains", Encode(string.Join(";", Domains)));
            }

            if (RetryCount > 0)
            {
                island.AddUserAttribute("retry-count", RetryCount.ToString(CultureInfo.InvariantCulture));
                island.AddUserAttribute("retry-delay", RetryDelayMilliseconds.ToString(CultureInfo.InvariantCulture));
            }

            AddMappingElements(island, "wx-query", "name", "wire", Query);
            AddMappingElements(island, "wx-response", "name", "wire", Response);
            AddMappingElements(island, "wx-header", "name", "value", Headers);
            AddMappingElements(island, "wx-error", "status", "message", Errors);

            return island;
        }

        /// <summary>
        /// Adds one child element per mapping entry, with the key and value as
        /// the given attribute names.
        /// </summary>
        /// <param name="island">The island element.</param>
        /// <param name="elementName">The child element name.</param>
        /// <param name="keyAttribute">The attribute carrying the mapping key.</param>
        /// <param name="valueAttribute">The attribute carrying the mapping value.</param>
        /// <param name="mapping">The mapping entries.</param>
        private static void AddMappingElements(HtmlElement island, string elementName, string keyAttribute, string valueAttribute, IDictionary<string, string> mapping)
        {
            foreach (var entry in mapping)
            {
                var child = new HtmlElement(elementName);
                child.AddUserAttribute(keyAttribute, Encode(entry.Key));
                child.AddUserAttribute(valueAttribute, Encode(entry.Value));
                island.Add(child);
            }
        }

        /// <summary>
        /// HTML encodes an attribute value, because the html attribute writer
        /// emits values verbatim.
        /// </summary>
        /// <param name="value">The raw value.</param>
        /// <returns>The encoded value, or null when absent.</returns>
        private static string Encode(string value)
        {
            return string.IsNullOrEmpty(value) ? null : WebUtility.HtmlEncode(value);
        }
    }
}
