using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Meta information of a CRUD option (e.g. Edit, Delete, ...).
    /// </summary>
    public class ControlRestTableOption
    {
        /// <summary>
        /// Returns or sets the label of the option entry. Null for separators.
        /// </summary>
        [JsonPropertyName("label")]
        public string Label { get; set; }

        /// <summary>
        /// Returns or sets the icon of the option entry.
        /// </summary>
        [JsonPropertyName("icon")]
        public string Icon { get; set; }

        /// <summary>
        /// Returns or sets the color of the option entry.
        /// </summary>
        [JsonPropertyName("color")]
        public string Color { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        public ControlRestTableOption()
        {
        }
    }
}
