using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Carries the values a client sends when it creates or changes a
    /// user-defined quick filter. The read model (<see cref="RestApiQuickfilterItem"/>)
    /// derives its icon and color from typed properties and is therefore not
    /// deserializable; this payload holds the raw values instead.
    /// </summary>
    public class RestApiQuickfilterPayload
    {
        /// <summary>
        /// Gets or sets the id of the filter. It is empty when a filter is
        /// created, because the id is assigned by the endpoint.
        /// </summary>
        [JsonPropertyName("id")]
        public string Id { get; set; }

        /// <summary>
        /// Gets or sets the display name of the filter.
        /// </summary>
        [JsonPropertyName("name")]
        public string Name { get; set; }

        /// <summary>
        /// Gets or sets the icon spec, a css class or an image uri.
        /// </summary>
        [JsonPropertyName("icon")]
        public string Icon { get; set; }

        /// <summary>
        /// Gets or sets the chip color as a raw css color, as picked in the client dialog.
        /// </summary>
        [JsonPropertyName("color")]
        public string Color { get; set; }

        /// <summary>
        /// Gets or sets what the filter selects. The framework never interprets
        /// this value; it travels unchanged between the client dialog and the
        /// endpoint, so an application is free to store a query, an expression or
        /// a serialized object of its own.
        /// </summary>
        [JsonPropertyName("criteria")]
        public string Criteria { get; set; }
    }
}
