using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents the body of a reply request issued by the comment control.
    /// </summary>
    public class RestApiCommentReplyPayload
    {
        /// <summary>
        /// Gets or sets the plain-text body of the reply.
        /// </summary>
        [JsonPropertyName("body")]
        public string Body { get; set; }
    }
}
