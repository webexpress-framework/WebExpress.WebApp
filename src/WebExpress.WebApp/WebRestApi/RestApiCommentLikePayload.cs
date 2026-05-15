using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents the body of a toggle-like request issued by the comment
    /// control.
    /// </summary>
    public class RestApiCommentLikePayload
    {
        /// <summary>
        /// Gets or sets the user id performing the like.
        /// </summary>
        [JsonPropertyName("userId")]
        public string UserId { get; set; }
    }
}
