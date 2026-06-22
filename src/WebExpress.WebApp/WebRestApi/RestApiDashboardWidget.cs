using System.Collections.Generic;
using System.Text.Json.Serialization;

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
        /// Gets or sets a value indicating whether the widget can be closed.
        /// </summary>
        [JsonPropertyName("closeable")]
        public bool Closeable { get; set; }

        /// <summary>
        /// Gets or sets the additional widget parameters.
        /// </summary>
        [JsonPropertyName("params")]
        public virtual Dictionary<string, string> Params { get; set; }
    }
}
