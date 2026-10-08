using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a single column in a column-layout update (rename / reorder /
    /// delete) sent by the dashboard and kanban controls. The position in the
    /// list defines the new column order.
    /// </summary>
    public class RestApiLayoutColumn
    {
        /// <summary>
        /// Gets or sets the statuses assigned to this column. An empty list prevents status transitions into it.
        /// </summary>
        [JsonPropertyName("statusIds")]
        public IEnumerable<string> StatusIds { get; set; }

        /// <summary>
        /// Gets or sets the column id.
        /// </summary>
        [JsonPropertyName("id")]
        public string Id { get; set; }

        /// <summary>
        /// Gets or sets the (possibly renamed) column title.
        /// </summary>
        [JsonPropertyName("title")]
        public string Title { get; set; }

        /// <summary>
        /// Gets or sets the optional column size (e.g. <c>1fr</c>, <c>25%</c>).
        /// </summary>
        [JsonPropertyName("size")]
        public string Size { get; set; }

        /// <summary>
        /// Gets or sets the optional column accent color.
        /// </summary>
        [JsonPropertyName("color")]
        public string Color { get; set; }
    }
}
