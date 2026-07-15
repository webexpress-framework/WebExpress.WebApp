using System.Text.Json.Serialization;
using WebExpress.WebCore.WebIcon;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebIcon;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Describes one quick-filter option in the data returned by a REST API.
    /// </summary>
    public class RestApiQuickfilterItem
    {
        /// <summary>
        /// Gets or sets the item id.
        /// </summary>
        [JsonPropertyName("id")]
        public string Id { get; set; }

        /// <summary>
        /// Gets or sets the name associated with the quickfilter.
        /// </summary>
        [JsonPropertyName("name")]
        public string Name { get; set; }

        /// <summary>
        /// Gets or sets the optional icon of the filter. The typed icon is
        /// authored here and collapses into the serialized spec, so no caller
        /// ever writes a raw CSS string or uri.
        /// </summary>
        [JsonIgnore]
        public IIcon Icon { get; set; }

        /// <summary>
        /// Gets the serialized icon spec, derived from <see cref="Icon"/>: an
        /// image icon contributes its picture uri, any other icon its CSS class.
        /// </summary>
        [JsonPropertyName("icon")]
        public string IconSpec => (Icon as ImageIcon)?.Uri?.ToString() ?? (Icon as Icon)?.Class;

        /// <summary>
        /// Gets or sets the chip color. The typed color is authored here and
        /// collapses into the serialized css class or raw color value, so no
        /// caller ever writes a raw CSS string; the client keeps the
        /// outline-to-filled chip behavior in that hue.
        /// </summary>
        [JsonIgnore]
        public PropertyColorButton Color { get; set; }

        /// <summary>
        /// Gets the button css class of a system color, derived from <see cref="Color"/>.
        /// </summary>
        [JsonPropertyName("color")]
        public string ColorCss => Color?.ToClass();

        /// <summary>
        /// Gets the raw css color of a user-defined color, derived from <see cref="Color"/>.
        /// </summary>
        [JsonPropertyName("colorValue")]
        public string ColorValue => Color?.UserColor;

        /// <summary>
        /// Gets or sets the optional badge text shown at the trailing edge of
        /// the filter, for example the number of matching entries. A null value
        /// hides the badge.
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
