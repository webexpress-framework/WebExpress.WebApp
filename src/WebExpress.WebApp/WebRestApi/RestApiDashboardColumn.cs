using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents the dashboard column structure.
    /// </summary>
    public class RestApiDashboardColumn
    {
        /// <summary>
        /// Returns or sets the column id.
        /// </summary>
        [JsonPropertyName("id")]
        public string Id { get; set; }

        /// <summary>
        /// Returns or sets the column label.
        /// </summary>
        [JsonPropertyName("label")]
        public string Label { get; set; }

        /// <summary>
        /// Returns or sets the column size.
        /// </summary>
        [JsonPropertyName("size")]
        public string Size { get; set; }

        /// <summary>
        /// Returns or sets the list of widgets in this column.
        /// </summary>
        [JsonPropertyName("widgets")]
        public List<RestApiDashboardWidget> Widgets { get; set; }
    }
}
