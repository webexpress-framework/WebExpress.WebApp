using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents the layout column received during a put request.
    /// </summary>
    public class RestApiDashboardLayoutColumn
    {
        /// <summary>
        /// Gets or sets the column id.
        /// </summary>
        [JsonPropertyName("columnId")]
        public string ColumnId { get; set; }

        /// <summary>
        /// Gets or sets the ordered list of widget ids.
        /// </summary>
        [JsonPropertyName("widgets")]
        public List<string> Widgets { get; set; }
    }
}
