using System.Collections.Generic;
using System.Text.Json.Serialization;
using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// A single node of the REST sidebar navigation tree. The node is projected
    /// into the item descriptor the client sidebar consumes, so a link, a header
    /// or a divider, a badge and a nested subtree are all authored on the server.
    /// The property names map one to one onto the client field names once the
    /// result serializes them with the camel case policy.
    /// </summary>
    public class RestApiSidebarItem
    {
        /// <summary>
        /// Gets or sets the node type. A null or "item" value is a navigable
        /// link; "header" is a non-interactive section caption and "divider" is
        /// a separator. The convenience subclasses set this for the author.
        /// </summary>
        public string Type { get; set; }

        /// <summary>
        /// Gets or sets the optional element id carried onto the rendered row.
        /// </summary>
        public string Id { get; set; }

        /// <summary>
        /// Gets or sets the display label of the link or header.
        /// </summary>
        public string Label { get; set; }

        /// <summary>
        /// Gets or sets the icon css class, for example "fas fa-inbox".
        /// </summary>
        public string Icon { get; set; }

        /// <summary>
        /// Gets or sets an image uri used in place of an icon.
        /// </summary>
        public string Image { get; set; }

        /// <summary>
        /// Gets or sets the target uri the link navigates to.
        /// </summary>
        public string Uri { get; set; }

        /// <summary>
        /// Gets or sets the link target, for example "_blank".
        /// </summary>
        public string Target { get; set; }

        /// <summary>
        /// Gets or sets whether the link renders as the active entry.
        /// </summary>
        public bool? Active { get; set; }

        /// <summary>
        /// Gets or sets whether the link renders as disabled.
        /// </summary>
        public bool? Disabled { get; set; }

        /// <summary>
        /// Gets or sets the badge text shown at the trailing edge of the link,
        /// for example an unread count. A null value hides the badge.
        /// </summary>
        public string Badge { get; set; }

        /// <summary>
        /// Gets or sets the badge background color. The typed color is authored
        /// here and collapses into the serialized css class or inline style, so
        /// no caller ever writes a raw CSS string.
        /// </summary>
        [JsonIgnore]
        public PropertyColorBackgroundBadge BadgeColor { get; set; }

        /// <summary>
        /// Gets the CSS class of a system badge color, derived from <see cref="BadgeColor"/>,
        /// for example "text-bg-primary".
        /// </summary>
        [JsonPropertyName("badgeColor")]
        public string BadgeColorCss => BadgeColor?.ToClass();

        /// <summary>
        /// Gets the inline style of a user-defined badge color, derived from <see cref="BadgeColor"/>.
        /// </summary>
        [JsonPropertyName("badgeStyle")]
        public string BadgeColorStyle => BadgeColor?.ToStyle();

        /// <summary>
        /// Gets or sets whether a node that owns children starts expanded.
        /// </summary>
        public bool? Expanded { get; set; }

        /// <summary>
        /// Gets or sets the child nodes nested under this link. A non-empty
        /// collection turns the link into a collapsible group.
        /// </summary>
        public IEnumerable<RestApiSidebarItem> Items { get; set; }
    }
}
