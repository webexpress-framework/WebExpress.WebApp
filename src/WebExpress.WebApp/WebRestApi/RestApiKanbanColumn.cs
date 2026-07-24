using System.Text.Json.Serialization;
using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a Kanban column as defined by a REST API.
    /// </summary>
    public class RestApiKanbanColumn
    {
        /// <summary>
        /// Gets or sets the unique identifier for the column.
        /// </summary>
        [JsonPropertyName("id")]
        public string Id { get; set; }

        /// <summary>
        /// Gets or sets the display label associated with this column.
        /// </summary>
        [JsonPropertyName("label")]
        public string Label { get; set; }

        /// <summary>
        /// Gets or sets the optional column width (e.g. <c>1fr</c>, <c>25%</c>),
        /// chosen through the column "…" menu.
        /// </summary>
        [JsonPropertyName("size")]
        public string Size { get; set; }

        /// <summary>
        /// Gets or sets the optional accent color (hex) of the column header,
        /// chosen through the column "…" menu.
        /// </summary>
        [JsonPropertyName("color")]
        public string Color { get; set; }

        /// <summary>
        /// Gets or sets the CSS color value associated with this column.
        /// </summary>
        [JsonPropertyName("colorCss")]
        public string ColorCss { get; set; }

        /// <summary>
        /// Gets or sets the optional badge text shown at the trailing edge of the
        /// column header, for example the number of cards in the column. A null
        /// value hides the badge.
        /// </summary>
        [JsonPropertyName("badge")]
        public string Badge { get; set; }

        /// <summary>
        /// Gets or sets the badge background color. The typed color is authored
        /// here and collapses into the serialized css class or inline style, so
        /// no caller ever writes a raw CSS string.
        /// </summary>
        [JsonIgnore]
        public PropertyColorBackgroundBadge BadgeColor { get; set; }

        /// <summary>
        /// Gets the CSS class of a system badge color, derived from <see cref="BadgeColor"/>.
        /// </summary>
        [JsonPropertyName("badgeColor")]
        public string BadgeColorCss => BadgeColor?.ToClass();

        /// <summary>
        /// Gets the inline style of a user-defined badge color, derived from <see cref="BadgeColor"/>.
        /// </summary>
        [JsonPropertyName("badgeStyle")]
        public string BadgeColorStyle => BadgeColor?.ToStyle();
    }
}
