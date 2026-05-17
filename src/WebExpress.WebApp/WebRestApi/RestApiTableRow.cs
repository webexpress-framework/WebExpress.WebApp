using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a row definition for a REST API-based CRUD table, including metadata such as label, icon, width, and
    /// rendering logic.
    /// </summary>
    public class RestApiTableRow
    {
        /// <summary>
        /// Gets or sets the id.
        /// </summary>
        [JsonPropertyName("id")]
        public object Id { get; set; }

        /// <summary>
        /// Gets or sets the cells.
        /// </summary>
        [JsonPropertyName("cells")]
        public IEnumerable<RestApiTableCell> Cells { get; set; } = [];

        /// <summary>
        /// Gets or sets the options associated with the REST API CRUD row.
        /// </summary>
        [JsonPropertyName("options")]
        public IEnumerable<IDictionary<string, object>> Options { get; set; } = [];

        /// <summary>
        /// Gets or sets the icon.
        /// </summary>
        [JsonPropertyName("icon")]
        public string Icon { get; set; }

        /// <summary>
        /// Gets or sets the image.
        /// </summary>
        [JsonPropertyName("image")]
        public string Image { get; set; }

        /// <summary>
        /// Gets or sets the target uri for the item.
        /// </summary>
        [JsonPropertyName("uri")]
        public string Uri { get; set; }

        /// <summary>
        /// Gets or sets the uri for the rest api (edit).
        /// </summary>
        [JsonPropertyName("restApi")]
        public string RestApi { get; set; }

        /// <summary>
        /// Gets or sets the primary action.
        /// </summary>
        [JsonPropertyName("primaryAction")]
        public IDictionary<string, object> PrimaryAction { get; set; }

        /// <summary>
        /// Gets or sets the secondary action.
        /// </summary>
        [JsonPropertyName("secondaryAction")]
        public IDictionary<string, object> SecondaryAction { get; set; }

        /// <summary>
        /// Gets or sets the data source identifier used for binding 
        /// operations.
        /// </summary>
        [JsonPropertyName("bind")]
        public IDictionary<string, object> Bind { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        public RestApiTableRow()
        {
        }
    }
}
