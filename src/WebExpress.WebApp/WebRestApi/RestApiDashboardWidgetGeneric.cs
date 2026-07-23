using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// A dashboard widget whose type id, name, color and params are supplied at
    /// runtime rather than baked into a strongly-typed subclass. It backs the
    /// widgets a user adds or reconfigures through the board "…" menu, where the
    /// concrete type is only known to the server as its client registry id, so
    /// an endpoint can store an arbitrary widget without a matching C# type.
    /// </summary>
    public class RestApiDashboardWidgetGeneric : RestApiDashboardWidget
    {
        private readonly string _id;
        private Dictionary<string, string> _params;

        /// <summary>
        /// Initializes a new instance of the class with the given type id.
        /// </summary>
        /// <param name="id">The widget type id.</param>
        public RestApiDashboardWidgetGeneric(string id)
        {
            _id = id;
        }

        /// <summary>
        /// Gets the widget type id supplied at construction.
        /// </summary>
        [JsonPropertyName("id")]
        public override string Id => _id;

        /// <summary>
        /// Gets or sets the type-specific params, stored and returned verbatim so
        /// any widget's settings survive the round trip.
        /// </summary>
        [JsonPropertyName("params")]
        public override Dictionary<string, string> Params
        {
            get => _params;
            set => _params = value;
        }
    }
}
