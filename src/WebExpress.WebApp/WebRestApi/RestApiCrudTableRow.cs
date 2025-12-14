using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a row definition for a REST API-based CRUD table, including metadata such as label, icon, width, and
    /// rendering logic.
    /// </summary>
    public class RestApiCrudTableRow
    {
        /// <summary>
        /// Returns or sets the id.
        /// </summary>
        [JsonPropertyName("id")]
        public object Id { get; set; }

        /// <summary>
        /// Returns or sets the cells.
        /// </summary>
        [JsonPropertyName("cells")]
        public IEnumerable<RestApiCrudTableCell> Cells { get; set; } = [];

        /// <summary>
        /// Returns or sets the options associated with the REST API CRUD row.
        /// </summary>
        [JsonPropertyName("options")]
        public IEnumerable<RestApiOption> Options { get; set; } = [];

        /// <summary>
        /// Returns or sets the icon.
        /// </summary>
        [JsonPropertyName("icon")]
        public string Icon { get; set; }

        /// <summary>
        /// Returns or sets the image.
        /// </summary>
        [JsonPropertyName("image")]
        public string Image { get; set; }

        /// <summary>
        /// Returns or sets the target uri for the item.
        /// </summary>
        [JsonPropertyName("uri")]
        public string Uri { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        public RestApiCrudTableRow()
        {
        }
    }
}
