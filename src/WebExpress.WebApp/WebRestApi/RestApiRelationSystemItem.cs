using System.Collections.Generic;
using System.Text.Json.Serialization;
using WebExpress.WebApp.WebRelation;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// One registered link system as the add dialog renders it in its sidebar,
    /// together with the relation types it offers. The dialog needs no
    /// second round trip after the user picks a system, and a system a plugin
    /// contributed appears without any change to the dialog.
    /// </summary>
    public class RestApiRelationSystemItem
    {
        /// <summary>
        /// Gets or sets the stable id of the system.
        /// </summary>
        [JsonPropertyName("id")]
        public string Id { get; set; }

        /// <summary>
        /// Gets or sets the display name of the system, already translated.
        /// </summary>
        [JsonPropertyName("label")]
        public string Label { get; set; }

        /// <summary>
        /// Gets or sets the sentence shown above the fields, already translated.
        /// </summary>
        [JsonPropertyName("description")]
        public string Description { get; set; }

        /// <summary>
        /// Gets or sets the category token, <c>object</c> or <c>external</c>.
        /// </summary>
        [JsonPropertyName("kind")]
        public string Kind { get; set; }

        /// <summary>
        /// Gets or sets the short badge text rendered as the tile of the entry.
        /// </summary>
        [JsonPropertyName("badge")]
        public string Badge { get; set; }

        /// <summary>
        /// Gets or sets the css color of the badge.
        /// </summary>
        [JsonPropertyName("color")]
        public string Color { get; set; }

        /// <summary>
        /// Gets or sets the id of the contributing plugin, absent for a native
        /// system. The dialog groups by it.
        /// </summary>
        [JsonPropertyName("plugin")]
        public string Plugin { get; set; }

        /// <summary>
        /// Gets or sets the version of the contributing plugin.
        /// </summary>
        [JsonPropertyName("version")]
        public string Version { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether the system accepts new links.
        /// </summary>
        [JsonPropertyName("enabled")]
        public bool Enabled { get; set; }

        /// <summary>
        /// Gets or sets the id of the client panel that renders the fields of the
        /// system. Absent, the dialog falls back to the generic panel of the
        /// category, which is what lets a plugin contribute a system without
        /// shipping JavaScript.
        /// </summary>
        [JsonPropertyName("panel")]
        public string Panel { get; set; }

        /// <summary>
        /// Gets or sets the relation types the system offers, already translated.
        /// </summary>
        [JsonPropertyName("types")]
        public IEnumerable<RestApiRelationTypeItem> Types { get; set; }

        /// <summary>
        /// Projects a registered system onto the wire. The texts are translated
        /// by the caller, which holds the culture of the request.
        /// </summary>
        /// <param name="system">The registered system.</param>
        /// <param name="label">The translated label.</param>
        /// <param name="description">The translated description.</param>
        /// <param name="types">The translated types the system offers.</param>
        /// <returns>The wire item, or <see langword="null"/> when the system is absent.</returns>
        public static RestApiRelationSystemItem From(IRelationSystem system, string label, string description, IEnumerable<RestApiRelationTypeItem> types)
        {
            return system == null ? null : new RestApiRelationSystemItem
            {
                Id = system.Id,
                Label = label,
                Description = description,
                Kind = RestApiRelationWire.Token(system.Kind),
                Badge = system.Badge,
                Color = system.Color,
                Plugin = system.Plugin,
                Version = system.Version,
                Enabled = system.Enabled,
                Types = types
            };
        }
    }
}
