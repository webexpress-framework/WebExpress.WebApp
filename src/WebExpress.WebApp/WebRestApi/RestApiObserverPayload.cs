using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents the body of an add-observer request issued by the
    /// observer control.
    /// </summary>
    public class RestApiObserverPayload
    {
        /// <summary>
        /// Gets or sets the id of the user to be added as an observer.
        /// </summary>
        [JsonPropertyName("userId")]
        public string UserId { get; set; }
    }
}
