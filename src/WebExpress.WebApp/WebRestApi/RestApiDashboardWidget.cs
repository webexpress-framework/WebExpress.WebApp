using System.Collections.Generic;
using System.Text.Json.Serialization;
using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Describes one widget of a dashboard in the data returned by a REST API.
    /// </summary>
    public class RestApiDashboardWidget
    {
        /// <summary>
        /// Gets or sets the widget id.
        /// </summary>
        [JsonPropertyName("id")]
        public virtual string Id { get; private set; }

        /// <summary>
        /// Gets or sets the id of this one widget on the board. The widget id
        /// names the type and is shared by every widget of that type, so a
        /// client that keeps a widget across a reload - an open delete
        /// confirmation or settings dialog - needs this to find it again. The
        /// board update sends it back for the endpoint to store; left unset,
        /// the client makes up a new one on every load.
        /// </summary>
        [JsonPropertyName("instanceId")]
        public string InstanceId { get; set; }

        /// <summary>
        /// Gets or sets the widget title.
        /// </summary>
        [JsonPropertyName("title")]
        public string Title { get; set; }

        /// <summary>
        /// Gets or sets the widget color.
        /// </summary>
        [JsonPropertyName("color")]
        public string Color { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether the widget is movable.
        /// </summary>
        [JsonPropertyName("movable")]
        public bool? Movable { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether the widget can be closed. Left
        /// unset, the widget stays closeable, as on the client.
        /// </summary>
        [JsonPropertyName("closeable")]
        public bool? Closeable { get; set; }

        /// <summary>
        /// Gets or sets the optional badge text shown at the trailing edge of the
        /// widget header, for example an item count or a status. A null value
        /// hides the badge.
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
        /// Gets or sets the additional widget parameters.
        /// </summary>
        [JsonPropertyName("params")]
        public virtual Dictionary<string, string> Params { get; set; }
    }
}
