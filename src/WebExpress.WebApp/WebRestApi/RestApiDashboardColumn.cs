using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Describes one column of a dashboard in the data returned by a REST API.
    /// </summary>
    public class RestApiDashboardColumn
    {
        /// <summary>
        /// Gets or sets the column id.
        /// </summary>
        [JsonPropertyName("id")]
        public string Id { get; set; }

        /// <summary>
        /// Gets or sets the column label.
        /// </summary>
        [JsonPropertyName("label")]
        public string Label { get; set; }

        /// <summary>
        /// Gets or sets the column size.
        /// </summary>
        [JsonPropertyName("size")]
        public string Size { get; set; }

        /// <summary>
        /// Gets or sets the list of widgets in this column.
        /// </summary>
        [JsonPropertyName("widgets")]
        public List<RestApiDashboardWidget> Widgets { get; set; }
    }
}
