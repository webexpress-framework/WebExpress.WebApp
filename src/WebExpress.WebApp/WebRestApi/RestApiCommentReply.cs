using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a single reply nested under a <see cref="RestApiCommentItem"/>.
    /// </summary>
    public class RestApiCommentReply
    {
        /// <summary>
        /// Gets or sets the unique identifier of the reply.
        /// </summary>
        [JsonPropertyName("id")]
        public string Id { get; set; }

        /// <summary>
        /// Gets or sets the id of the reply's author.
        /// </summary>
        [JsonPropertyName("author")]
        public string Author { get; set; }

        /// <summary>
        /// Gets or sets the plain-text body of the reply.
        /// </summary>
        [JsonPropertyName("body")]
        public string Body { get; set; }

        /// <summary>
        /// Gets or sets the formatted timestamp displayed next to the author.
        /// </summary>
        [JsonPropertyName("when")]
        public string When { get; set; }
    }
}
