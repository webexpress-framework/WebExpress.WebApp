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
    }
}
