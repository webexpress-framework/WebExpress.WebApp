using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a single tag (label) as exposed by the REST API and
    /// rendered by the client-side <c>webexpress.webapp.TagCtrl</c>.
    /// </summary>
    public class RestApiTagItem
    {
        /// <summary>
        /// Gets or sets the value (display text) of the tag. The value also
        /// serves as the identity of the tag.
        /// </summary>
        [JsonPropertyName("value")]
        public string Value { get; set; }

        /// <summary>
        /// Gets or sets an optional CSS color class or color value used to
        /// render the tag chip. When omitted, the client uses its default
        /// color.
        /// </summary>
        [JsonPropertyName("color")]
        public string Color { get; set; }
    }
}
