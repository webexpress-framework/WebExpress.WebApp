using System.Text.Json.Serialization;
using WebExpress.WebApp.WebAttribute;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a column in a REST CRUD resource.
    /// </summary>
    public class RestApiTableColumn
    {
        /// <summary>
        /// Returns or sets the name of the associated property of the item that corresponds to the column.
        /// </summary>
        [JsonPropertyName("name")]
        public string Name { get; set; }

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
        /// Returns or sets the path to the template file for rendering the column.
        /// </summary>
        [JsonPropertyName("template")]
        public IRestTableColumnTemplate Template { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        public RestApiTableColumn()
        {
        }
    }
}