using System;
using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a selectable dropdown entry returned by a REST endpoint, and the base
    /// type for the structural entries that share its stream:
    /// <see cref="RestApiDropdownItemHeader"/> (a non-clickable caption) and
    /// <see cref="RestApiDropdownItemDivider"/> (a separator). The client distinguishes
    /// them by the <see cref="Type"/> value, which is why these entries travel inside the
    /// same item stream rather than as a separate top-level field: it lets an endpoint
    /// interleave them freely between items.
    /// </summary>
    public class RestApiDropdownItem
    {
        /// <summary>
        /// The <see cref="Type"/> value for a regular, selectable item.
        /// </summary>
        public const string TypeItem = "item";

        /// <summary>
        /// The <see cref="Type"/> value for a non-clickable group heading.
        /// </summary>
        public const string TypeHeader = "header";

        /// <summary>
        /// The <see cref="Type"/> value for a visual separator between items.
        /// </summary>
        public const string TypeDivider = "divider";

        /// <summary>
        /// Gets or sets the kind of entry. The client treats anything other than
        /// <see cref="TypeHeader"/> or <see cref="TypeDivider"/> as a selectable
        /// item, so the value must match these constants verbatim to render as a
        /// header or divider.
        /// </summary>
        [JsonPropertyName("type")]
        public string Type { get; set; } = TypeItem;

        /// <summary>
        /// Gets or sets the unique item identifier.
        /// </summary>
        [JsonPropertyName("id")]
        public Guid Id { get; set; }

        /// <summary>
        /// Gets or sets the display text of the item.
        /// </summary>
        [JsonPropertyName("text")]
        public string Text { get; set; }

        /// <summary>
        /// Gets or sets the target uri for the item.
        /// </summary>
        [JsonPropertyName("uri")]
        public string Uri { get; set; }

        /// <summary>
        /// Gets or sets the icon uri for the item.
        /// </summary>
        [JsonPropertyName("icon")]
        public string Icon { get; set; }

        /// <summary>
        /// Gets or sets the image icon uri for the item.
        /// </summary>
        [JsonPropertyName("image")]
        public string Image { get; set; }
    }
}
