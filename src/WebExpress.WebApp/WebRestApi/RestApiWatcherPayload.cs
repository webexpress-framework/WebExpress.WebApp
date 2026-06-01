using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents the body of an add-watcher request issued by the
    /// watcher control.
    /// </summary>
    public class RestApiWatcherPayload
    {
        /// <summary>
        /// Gets or sets the id of the user to be added as an watcher.
        /// </summary>
        [JsonPropertyName("userId")]
        public string UserId { get; set; }
    }
}
