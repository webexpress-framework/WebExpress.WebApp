using System.Collections.Generic;
using System.Text.Json;

namespace WebExpress.WebApp.WebData
{
    /// <summary>
    /// A typed, C# authored description of the initial state of a View, State
    /// and Service component. The author sets keys and values, where the values
    /// come from the existing C# lambdas, and the state serializes into the
    /// compact data-wx-state JSON island that the JavaScript Component seeds its
    /// store from on the first render. Server side initial data can be embedded
    /// here so the first paint needs no round trip.
    ///
    /// This is a C# artifact of the architecture described in
    /// WebExpress/docs/view-state-service.md (section 3.2, 8). It is consumed by
    /// the engine through webexpress.webapp.Data.readState.
    /// </summary>
    public class DataState
    {
        private static readonly JsonSerializerOptions IslandOptions = new()
        {
            WriteIndented = false
        };

        private readonly Dictionary<string, object> _values = new();

        /// <summary>
        /// Gets a value indicating whether the state carries no keys, in which
        /// case the control omits the island entirely.
        /// </summary>
        public bool IsEmpty => _values.Count == 0;

        /// <summary>
        /// Creates an empty state.
        /// </summary>
        /// <returns>The state for chaining.</returns>
        public static DataState Create()
        {
            return new DataState();
        }

        /// <summary>
        /// Sets a state key to a value. The value is serialized by its runtime
        /// type, so numbers, strings, booleans, arrays and objects are all
        /// supported. A later set with the same key replaces the earlier value.
        /// </summary>
        /// <param name="key">The state key.</param>
        /// <param name="value">The initial value.</param>
        /// <returns>The state for chaining.</returns>
        public DataState Set(string key, object value)
        {
            _values[key] = value;
            return this;
        }

        /// <summary>
        /// Sets the initial page index. The key belongs to the closed state
        /// vocabulary of the data controls, so it is typed rather than spelled
        /// as a string at the call site.
        /// </summary>
        /// <param name="page">The page index.</param>
        /// <returns>The state for chaining.</returns>
        public DataState Page(int page) => Set("page", page);

        /// <summary>
        /// Sets the initial page size.
        /// </summary>
        /// <param name="pageSize">The page size.</param>
        /// <returns>The state for chaining.</returns>
        public DataState PageSize(int pageSize) => Set("pageSize", pageSize);

        /// <summary>
        /// Sets the initial search pattern.
        /// </summary>
        /// <param name="search">The search pattern.</param>
        /// <returns>The state for chaining.</returns>
        public DataState Search(string search) => Set("search", search);

        /// <summary>
        /// Sets the identifier of the resource the control binds to, for
        /// example the workflow an editor loads and saves. The id is purely
        /// logical here, the wire name of the matching query parameter stays
        /// with the service descriptor.
        /// </summary>
        /// <param name="id">The resource identifier.</param>
        /// <returns>The state for chaining.</returns>
        public DataState Id(string id) => Set("id", id);

        /// <summary>
        /// Embeds server side initial data, so the first paint needs no round
        /// trip and the component skips the load on mount.
        /// </summary>
        /// <param name="items">The initial items.</param>
        /// <returns>The state for chaining.</returns>
        public DataState Items(object items) => Set("items", items);

        /// <summary>
        /// Serializes the state into the compact JSON island that the JavaScript
        /// Component seeds its store from. The caller is responsible for HTML
        /// attribute encoding when the result is written into a data-wx-state
        /// attribute.
        /// </summary>
        /// <returns>The compact JSON representation.</returns>
        public string ToIsland()
        {
            return JsonSerializer.Serialize(_values, IslandOptions);
        }
    }
}
