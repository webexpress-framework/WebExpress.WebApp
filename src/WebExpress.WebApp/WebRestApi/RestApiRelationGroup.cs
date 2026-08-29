using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// The links of one relation type, as the surface renders them: a heading
    /// carrying both labels of the relation and the links below it. The grouping
    /// happens on the server, because only the server knows the order the types
    /// are administered in and can keep it stable across pages.
    /// </summary>
    public class RestApiRelationGroup
    {
        /// <summary>
        /// Gets or sets the id of the relation type the group collects.
        /// </summary>
        [JsonPropertyName("type")]
        public string Type { get; set; }

        /// <summary>
        /// Gets or sets the label of the relation as read from the rendering
        /// object, already translated.
        /// </summary>
        [JsonPropertyName("label")]
        public string Label { get; set; }

        /// <summary>
        /// Gets or sets the label of the relation as read from the other end,
        /// already translated. The surface renders it as the counterpart badge
        /// next to the heading, so the user sees what the link says over there.
        /// </summary>
        [JsonPropertyName("counterpart")]
        public string Counterpart { get; set; }

        /// <summary>
        /// Gets or sets the icon of the relation, as a symbolic name of the icon
        /// set.
        /// </summary>
        [JsonPropertyName("icon")]
        public string Icon { get; set; }

        /// <summary>
        /// Gets or sets the workflow effect token of the relation, which the
        /// surface may render as a hint on the heading.
        /// </summary>
        [JsonPropertyName("effect")]
        public string Effect { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether both ends of the relation are
        /// named alike, in which case no counterpart badge is rendered.
        /// </summary>
        [JsonPropertyName("symmetric")]
        public bool Symmetric { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether the group collects the links
        /// the rendering object is the target of. A type therefore yields up to
        /// two groups - "blocks" and "is blocked by" - which is what the surface
        /// lists as two headings.
        /// </summary>
        [JsonPropertyName("inverse")]
        public bool Inverse { get; set; }

        /// <summary>
        /// Gets or sets the number of links in the group, which may exceed the
        /// number of items when the surface pages.
        /// </summary>
        [JsonPropertyName("count")]
        public int Count { get; set; }

        /// <summary>
        /// Gets or sets the links of the group.
        /// </summary>
        [JsonPropertyName("items")]
        public IEnumerable<RestApiRelationItem> Items { get; set; }
    }
}
