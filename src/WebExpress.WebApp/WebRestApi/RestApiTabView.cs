using System.Text.Json.Serialization;
using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a tab view configuration for a REST API, including display 
    /// and identification properties.
    /// </summary>
    public class RestApiTabView : IRestApiTabView
    {
        /// <summary>
        /// Gets or sets the unique identifier for the tab view.
        /// </summary>
        [JsonPropertyName("id")]
        public string Id { get; set; }

        /// <summary>
        /// Gets or sets the display label associated with the object.
        /// </summary>
        [JsonPropertyName("label")]
        public string Title { get; set; }

        /// <summary>
        /// Gets or sets the name associated with the object.
        /// </summary>
        [JsonPropertyName("name")]
        public string Name { get; set; }

        /// <summary>
        /// Gets or sets the name or path of the icon associated with this instance.
        /// </summary>
        [JsonPropertyName("icon")]
        public string Icon { get; set; }

        /// <summary>
        /// Gets or sets the identifier of the template associated with this instance.
        /// </summary>
        [JsonPropertyName("templateId")]
        public string TemplateId { get; set; }

        /// <summary>
        /// Gets or sets the URI associated with this instance.
        /// </summary>
        [JsonPropertyName("uri")]
        public string Uri { get; set; }

        /// <summary>
        /// Gets or sets the optional color class associated with this tab.
        /// </summary>
        [JsonPropertyName("color")]
        public string Color { get; set; }

        /// <summary>
        /// Gets or sets the optional badge text shown at the trailing edge of
        /// the tab header, for example the number of entries in the view. A
        /// null value hides the badge.
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

        /// <summary>
        /// Gets or sets the optional primary action identifier.
        /// </summary>
        [JsonPropertyName("primaryAction")]
        public string PrimaryAction { get; set; }

        /// <summary>
        /// Gets or sets the optional primary action target.
        /// </summary>
        [JsonPropertyName("primaryTarget")]
        public string PrimaryTarget { get; set; }

        /// <summary>
        /// Gets or sets the optional binding payload used by template bindings.
        /// </summary>
        [JsonPropertyName("binding")]
        public object Binding { get; set; }
    }
}
