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
        /// Returns or sets the id.
        /// </summary>
        [JsonPropertyName("id")]
        public object Id { get; set; }

        /// <summary>
        /// Returns or sets the cells.
        /// </summary>
        [JsonPropertyName("cells")]
        public IEnumerable<RestApiTableCell> Cells { get; set; } = [];

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
        /// Returns or sets the uri for the rest api (edit).
        /// </summary>
        [JsonPropertyName("restApi")]
        public string RestApi { get; set; }

        /// <summary>
        /// Returns or sets the primary action.
        /// </summary>
        [JsonPropertyName("data-wx-primary-action")]
        public string DataWxPrimaryAction { get; set; }

        /// <summary>
        /// Returns or sets the primary target.
        /// </summary>
        [JsonPropertyName("data-wx-primary-target")]
        public string DataWxPrimaryTarget { get; set; }

        /// <summary>
        /// Returns or sets the primary URI.
        /// </summary>
        [JsonPropertyName("data-wx-primary-uri")]
        public string DataWxPrimaryUri { get; set; }

        /// <summary>
        /// Returns or sets the primary size.
        /// </summary>
        [JsonPropertyName("data-wx-primary-size")]
        public string DataWxPrimarySize { get; set; }

        /// <summary>
        /// Returns or sets the secondary action.
        /// </summary>
        [JsonPropertyName("data-wx-secondary-action")]
        public string DataWxSecondaryAction { get; set; }

        /// <summary>
        /// Returns or sets the secondary target.
        /// </summary>
        [JsonPropertyName("data-wx-secondary-target")]
        public string DataWxSecondaryTarget { get; set; }

        /// <summary>
        /// Returns or sets the secondary URI .
        /// </summary>
        [JsonPropertyName("data-wx-secondary-uri")]
        public string DataWxSecondaryUri { get; set; }

        /// <summary>
        /// Returns or sets the secondary size.
        /// </summary>
        [JsonPropertyName("data-wx-secondary-size")]
        public string DataWxSecondarySize { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        public RestApiTableRow()
        {
        }
    }
}
