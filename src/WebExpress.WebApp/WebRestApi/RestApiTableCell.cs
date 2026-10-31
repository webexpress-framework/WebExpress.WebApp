using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a cell in a table used for REST API CRUD operations.
    /// </summary>
    public class RestApiTableCell
    {
        /// <summary>
        /// Gets or sets the content.
        /// </summary>
        [JsonPropertyName("content")]
        public object Content { get; set; }

        /// <summary>
        /// Gets or sets whether this cell explicitly contains trusted application markup.
        /// Prefer column templates for shared formatting; ordinary values remain text.
        /// </summary>
        [JsonPropertyName("html")]
        public bool Html { get; set; }

        /// <summary>
        /// Gets or sets the cell class presentation value.
        /// </summary>
        [JsonPropertyName("class")]
        public string Class { get; set; }

        /// <summary>
        /// Gets or sets the cell style presentation value.
        /// </summary>
        [JsonPropertyName("style")]
        public string Style { get; set; }

        /// <summary>
        /// Gets or sets the cell color presentation value.
        /// </summary>
        [JsonPropertyName("color")]
        public string Color { get; set; }


        /// <summary>
        /// Gets or sets the explicit cell type override.
        /// </summary>
        [JsonPropertyName("type")]
        public string Type { get; set; }

        /// <summary>
        /// Gets or sets the explicit cell uri override.
        /// </summary>
        [JsonPropertyName("uri")]
        public string Uri { get; set; }

        /// <summary>
        /// Gets or sets the explicit cell icon override.
        /// </summary>
        [JsonPropertyName("icon")]
        public string Icon { get; set; }

        /// <summary>
        /// Gets or sets the explicit cell image override.
        /// </summary>
        [JsonPropertyName("image")]
        public string Image { get; set; }

        /// <summary>
        /// Gets or sets the explicit cell target override.
        /// </summary>
        [JsonPropertyName("target")]
        public string Target { get; set; }


        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        public RestApiTableCell()
        {
        }
    }
}
