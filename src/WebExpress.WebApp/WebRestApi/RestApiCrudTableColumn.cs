using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a column in a REST CRUD resource.
    /// </summary>
    public class RestApiCrudTableColumn
    {
        /// <summary>
        /// Returns or sets a value indicating whether the element is visible.
        /// </summary>
        [JsonPropertyName("visible")]
        public bool Visible { get; set; }

        /// <summary>
        /// Returns or sets the label.
        /// </summary>
        [JsonPropertyName("label")]
        public string Label { get; set; }

        /// <summary>
        /// Returns or sets the icon.
        /// </summary>
        [JsonPropertyName("icon")]
        public string Icon { get; set; }

        /// <summary>
        /// Returns or sets the width of the table column in percentage, null for auto.
        /// </summary>
        [JsonPropertyName("width")]
        public uint? Width { get; set; }

        /// <summary>
        /// Returns or sets the Javascript code that renders the data of the cell.
        /// </summary>
        [JsonPropertyName("render")]
        public string Render { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="label">The label of the column.</param>
        public RestApiCrudTableColumn(string label)
        {
            Label = label;
        }
    }
}
