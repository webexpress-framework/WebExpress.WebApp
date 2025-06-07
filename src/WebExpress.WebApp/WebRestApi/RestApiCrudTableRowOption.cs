using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a configuration option for a row in a REST API-based CRUD table.
    /// </summary>
    public class RestApiCrudTableRowOption
    {
        /// <summary>
        /// Returns or sets the id.
        /// </summary>
        [JsonPropertyName("id")]
        public string Id { get; set; }

        /// <summary>
        /// Returns or sets the label.
        /// </summary>
        [JsonPropertyName("content")]
        public string Label { get; set; }

        /// <summary>
        /// Returns or sets the icon.
        /// </summary>
        [JsonPropertyName("icon")]
        public string Icon { get; set; }

        /// <summary>
        /// Returns or sets the width of the table column in percentage, null for auto.
        /// </summary>
        [JsonPropertyName("width")]
        public uint? Width { get; set; }

        /// <summary>
        /// Returns or sets the Javascript code that renders the data of the cell.
        /// </summary>
        [JsonPropertyName("render")]
        public string Render { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        public RestApiCrudTableRowOption()
        {
        }
    }
}
