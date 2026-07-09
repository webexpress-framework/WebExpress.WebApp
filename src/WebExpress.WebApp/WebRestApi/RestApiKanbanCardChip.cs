using System.Text.Json.Serialization;
using WebExpress.WebCore.WebIcon;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebIcon;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a single chip in the optional footer of a Kanban card.
    /// The footer carries small, application-defined facts such as the priority
    /// or the story points, so the card layout stays generic while every
    /// application decides which information matters on its board.
    /// </summary>
    public class RestApiKanbanCardChip
    {
        /// <summary>
        /// Gets or sets the text shown inside the chip.
        /// </summary>
        [JsonPropertyName("label")]
        public string Label { get; set; }

        /// <summary>
        /// Gets or sets the icon of the chip. The typed icon is authored here
        /// and collapses into the serialized spec, so no caller ever writes a
        /// raw CSS string or uri.
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
        /// Gets or sets the color of the chip. The typed color is authored here
        /// and collapses into the serialized css class or inline style, so no
        /// caller ever writes a raw CSS string.
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

        /// <summary>
        /// Gets or sets the tooltip explaining the chip (for example "Story points").
        /// </summary>
        [JsonPropertyName("title")]
        public string Title { get; set; }
    }
}
