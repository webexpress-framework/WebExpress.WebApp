using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a container node within a form structure that arranges its
    /// children using a layout. Serialized with the wire-format discriminator
    /// <c>"kind": "group"</c>.
    /// </summary>
    public class RestApiFormEditorGroupItem : RestApiFormEditorNodeItem
    {
        /// <summary>
        /// Gets or sets the user-visible label of the group.
        /// </summary>
        [JsonPropertyName("label")]
        public string Label { get; set; }

        /// <summary>
        /// Gets or sets the layout id. One of:
        /// <c>vertical</c>, <c>horizontal</c>, <c>mix</c>,
        /// <c>col-vertical</c>, <c>col-horizontal</c>, <c>col-mix</c>.
        /// </summary>
        [JsonPropertyName("layout")]
        public string Layout { get; set; }

        /// <summary>
        /// Gets or sets the ordered list of child nodes inside the group.
        /// </summary>
        [JsonPropertyName("children")]
        public IEnumerable<RestApiFormEditorNodeItem> Children { get; set; }
    }
}
