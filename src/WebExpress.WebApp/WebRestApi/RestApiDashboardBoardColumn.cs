using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents one column of a full board update, carrying its meta and the
    /// widgets it holds. The position in the list defines the column order.
    /// </summary>
    public class RestApiDashboardBoardColumn
    {
        /// <summary>
        /// Gets or sets the column id.
        /// </summary>
        [JsonPropertyName("id")]
        public string Id { get; set; }

        /// <summary>
        /// Gets or sets the column title.
        /// </summary>
        [JsonPropertyName("title")]
        public string Title { get; set; }

        /// <summary>
        /// Gets or sets the column size (e.g. <c>1fr</c>, <c>25%</c>).
        /// </summary>
        [JsonPropertyName("size")]
        public string Size { get; set; }

        /// <summary>
        /// Gets or sets the column accent color.
        /// </summary>
        [JsonPropertyName("color")]
        public string Color { get; set; }

        /// <summary>
        /// Gets or sets the ordered widgets the column holds.
        /// </summary>
        [JsonPropertyName("widgets")]
        public List<RestApiDashboardBoardWidget> Widgets { get; set; }
    }
}
