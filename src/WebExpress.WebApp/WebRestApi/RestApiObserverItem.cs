using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a single observer (a.k.a. watcher) record as exposed by
    /// the REST API and rendered by the client-side
    /// <c>webexpress.webapp.ObserverCtrl</c>.
    /// </summary>
    public class RestApiObserverItem
    {
        /// <summary>
        /// Gets or sets the unique identifier of the observer.
        /// </summary>
        [JsonPropertyName("id")]
        public string Id { get; set; }

        /// <summary>
        /// Gets or sets the display name of the observer.
        /// </summary>
        [JsonPropertyName("name")]
        public string Name { get; set; }

        /// <summary>
        /// Gets or sets the optional team or group label of the observer.
        /// </summary>
        [JsonPropertyName("team")]
        public string Team { get; set; }

        /// <summary>
        /// Gets or sets the short text shown inside the avatar bubble
        /// (typically 1-2 characters).
        /// </summary>
        [JsonPropertyName("initials")]
        public string Initials { get; set; }

        /// <summary>
        /// Gets or sets the CSS color string used as the avatar background.
        /// </summary>
        [JsonPropertyName("color")]
        public string Color { get; set; }
    }
}
