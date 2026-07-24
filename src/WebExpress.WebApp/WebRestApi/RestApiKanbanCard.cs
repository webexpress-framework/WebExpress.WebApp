using System.Collections.Generic;
using System.Text.Json.Serialization;
using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a Kanban card as returned by the REST API.
    /// </summary>
    public class RestApiKanbanCard
    {
        /// <summary>
        /// Gets or sets the unique identifier for the card.
        /// </summary>
        [JsonPropertyName("id")]
        public string Id { get; set; }

        /// <summary>
        /// Gets or sets the display label associated with the card.
        /// </summary>
        [JsonPropertyName("label")]
        public string Label { get; set; }

        /// <summary>
        /// Gets or sets the HTML content associated with this card.
        /// </summary>
        [JsonPropertyName("html")]
        public string Html { get; set; }

        /// <summary>
        /// Gets or sets the unique identifier of the column.
        /// </summary>
        [JsonPropertyName("columnId")]
        public string ColumnId { get; set; }

        /// <summary>
        /// Gets or sets the unique identifier of the swimlane.
        /// </summary>
        [JsonPropertyName("swimlaneId")]
        public string SwimlaneId { get; set; }

        /// <summary>
        /// Gets or sets the CSS color value associated with this card.
        /// </summary>
        [JsonPropertyName("colorCss")]
        public string ColorCss { get; set; }

        /// <summary>
        /// Gets or sets the id of the person the card is assigned to, or
        /// <see langword="null"/> when the card is unassigned.
        /// </summary>
        [JsonPropertyName("assigneeId")]
        public string AssigneeId { get; set; }

        /// <summary>
        /// Gets or sets the display name of the assignee.
        /// </summary>
        [JsonPropertyName("assigneeName")]
        public string AssigneeName { get; set; }

        /// <summary>
        /// Gets or sets the short text shown inside the assignee avatar.
        /// </summary>
        [JsonPropertyName("assigneeInitials")]
        public string AssigneeInitials { get; set; }

        /// <summary>
        /// Gets or sets the CSS color used as the assignee avatar background.
        /// </summary>
        [JsonPropertyName("assigneeColor")]
        public string AssigneeColor { get; set; }

        /// <summary>
        /// Gets or sets the uri of the assignee avatar image. When present, the
        /// image replaces the initials badge.
        /// </summary>
        [JsonPropertyName("assigneeImage")]
        public string AssigneeImage { get; set; }

        /// <summary>
        /// Gets or sets the optional badge text shown at the trailing edge of the
        /// card header, for example a ticket number or an age. A null value hides
        /// the badge.
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

        /// <summary>
        /// Gets or sets the optional footer of the card: small, application-defined
        /// chips such as the priority or the story points.
        /// </summary>
        [JsonPropertyName("footer")]
        public IEnumerable<RestApiKanbanCardChip> Footer { get; set; }
    }
}
