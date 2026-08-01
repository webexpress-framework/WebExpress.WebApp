using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a time-based entry of a schedule as exposed by a REST API.
    /// </summary>
    /// <remarks>
    /// The timestamps are exchanged as local, zone-free text
    /// (<c>yyyy-MM-ddTHH:mm:ss</c>), the same form the static schedule emits. A
    /// zone offset would move an all-day entry to the previous day for every
    /// visitor west of the server.
    /// </remarks>
    public class RestApiScheduleItem
    {
        /// <summary>
        /// Gets or sets the unique identifier of the item.
        /// </summary>
        [JsonPropertyName("id")]
        public string Id { get; set; }

        /// <summary>
        /// Gets or sets the title shown on the entry.
        /// </summary>
        [JsonPropertyName("title")]
        public string Title { get; set; }

        /// <summary>
        /// Gets or sets the moment the item begins.
        /// </summary>
        [JsonPropertyName("start")]
        public string Start { get; set; }

        /// <summary>
        /// Gets or sets the moment the item ends. Without it the item ends on
        /// the day it begins.
        /// </summary>
        [JsonPropertyName("end")]
        public string End { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether the item occupies whole days
        /// rather than a span of hours.
        /// </summary>
        [JsonPropertyName("allDay")]
        public bool AllDay { get; set; }

        /// <summary>
        /// Gets or sets the category the item belongs to.
        /// </summary>
        [JsonPropertyName("category")]
        public string Category { get; set; }

        /// <summary>
        /// Gets or sets the CSS class the entry is coloured with, which keeps a
        /// themed entry in step with the stylesheet.
        /// </summary>
        [JsonPropertyName("colorCss")]
        public string ColorCss { get; set; }

        /// <summary>
        /// Gets or sets the inline style declaration the entry is coloured with,
        /// for a colour that is not part of the theme.
        /// </summary>
        [JsonPropertyName("colorStyle")]
        public string ColorStyle { get; set; }

        /// <summary>
        /// Gets or sets the icon shown in front of the title, as a CSS class.
        /// </summary>
        [JsonPropertyName("icon")]
        public string Icon { get; set; }

        /// <summary>
        /// Gets or sets the URI the entry links to.
        /// </summary>
        [JsonPropertyName("uri")]
        public string Uri { get; set; }

        /// <summary>
        /// Gets or sets the free-form metadata carried with the item, which
        /// reaches the click events and the custom renderer unchanged.
        /// </summary>
        [JsonPropertyName("meta")]
        public IDictionary<string, string> Meta { get; set; }
    }
}
