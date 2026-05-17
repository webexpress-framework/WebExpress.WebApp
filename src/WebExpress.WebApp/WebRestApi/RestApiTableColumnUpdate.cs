using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a single column entry sent by the client when reconfiguring
    /// the table layout (order, width, visibility).
    /// </summary>
    public class RestApiTableColumnUpdate
    {
        /// <summary>
        /// Gets or sets the identifier of the column. Must match the id of a
        /// column returned by <see cref="RestApiTable{TIndexItem}.RetrieveColums"/>.
        /// </summary>
        [JsonPropertyName("id")]
        public string Id { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether the column should be shown.
        /// </summary>
        [JsonPropertyName("visible")]
        public bool? Visible { get; set; }

        /// <summary>
        /// Gets or sets the user-defined column width in pixels. A null value
        /// indicates that the column should be auto-sized.
        /// </summary>
        [JsonPropertyName("width")]
        public uint? Width { get; set; }
    }
}
