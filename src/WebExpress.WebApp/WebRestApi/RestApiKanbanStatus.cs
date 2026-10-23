using System.Text.Json.Serialization;
using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Provides an application-defined workflow status for column assignment and card transitions.
    /// </summary>
    public class RestApiKanbanStatus
    {
        /// <summary>
        /// Gets or sets the stable workflow status identifier.
        /// </summary>
        [JsonPropertyName("id")]
        public string Id { get; set; }

        /// <summary>
        /// Gets or sets the localized display label used in status dialogs and on the cards.
        /// </summary>
        [JsonPropertyName("label")]
        public string Label { get; set; }

        /// <summary>
        /// Gets or sets the color of the status chip, so a workflow state is recognized
        /// at a glance on the cards and in the status dialogs. The typed color is authored
        /// here and collapses into the serialized css class or inline style, so no caller
        /// ever writes a raw CSS string. A null value keeps the neutral chip.
        /// </summary>
        [JsonIgnore]
        public PropertyColorBackgroundBadge Color { get; set; }

        /// <summary>
        /// Gets the CSS class of a system color, derived from <see cref="Color"/>.
        /// </summary>
        [JsonPropertyName("colorCss")]
        public string ColorCss => Color?.ToClass();

        /// <summary>
        /// Gets the inline style of a user-defined color, derived from <see cref="Color"/>.
        /// </summary>
        [JsonPropertyName("colorStyle")]
        public string ColorStyle => Color?.ToStyle();
    }
}
