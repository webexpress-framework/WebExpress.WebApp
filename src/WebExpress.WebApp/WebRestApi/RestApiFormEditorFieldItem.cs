using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a leaf field node within a form structure. Serialized with
    /// the wire-format discriminator <c>"kind": "field"</c>.
    /// </summary>
    public class RestApiFormEditorFieldItem : RestApiFormEditorNodeItem
    {
        /// <summary>
        /// Gets or sets the user-visible name (label) of the field.
        /// </summary>
        [JsonPropertyName("label")]
        public string Label { get; set; }

        /// <summary>
        /// Gets or sets the logical field type. One of:
        /// <c>string</c>, <c>text</c>, <c>timestamp</c>, <c>ref</c>, <c>enum</c>,
        /// <c>tags</c>, <c>number</c>, <c>file</c>.
        /// </summary>
        [JsonPropertyName("type")]
        public string Type { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether the field is required.
        /// </summary>
        [JsonPropertyName("required")]
        public bool Required { get; set; }

        /// <summary>
        /// Gets or sets the optional inline help text shown next to the field.
        /// </summary>
        [JsonPropertyName("help")]
        public string Help { get; set; }
    }
}
