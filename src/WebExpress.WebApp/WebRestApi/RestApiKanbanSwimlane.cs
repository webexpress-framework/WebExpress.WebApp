using System.Text.Json.Serialization;
using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a swimlane in a Kanban board as defined by a REST API response.
    /// </summary>
    public class RestApiKanbanSwimlane
    {
        /// <summary>
        /// Gets or sets the unique identifier for the swimlane.
        /// </summary>
        [JsonPropertyName("id")]
        public string Id { get; set; }

        /// <summary>
        /// Gets or sets the display label associated with the swimlane.
        /// </summary>
        [JsonPropertyName("label")]
        public string Label { get; set; }

        /// <summary>
        /// Gets or sets the CSS color value associated with this swimlane
        [JsonPropertyName("colorCss")]
        public string ColorCss { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether the swimlane is expanded.
        /// </summary>
        [JsonPropertyName("expanded")]
        public bool Expanded { get; set; }

        /// <summary>
        /// Gets or sets the optional WQL filter of the swimlane, echoed back so the
        /// swimlane settings dialog can seed its filter field.
        /// </summary>
        [JsonPropertyName("filter")]
        public string Filter { get; set; }

        /// <summary>
        /// Gets or sets the optional badge text shown at the trailing edge of the
        /// swimlane header, for example the number of cards in the lane. A null
        /// value hides the badge.
        /// </summary>
        [JsonPropertyName("badge")]
        public string Badge { get; set; }

        /// <summary>
        /// Gets or sets the badge background color. The typed color is authored
        /// here and collapses into the serialized css class or inline style.
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
