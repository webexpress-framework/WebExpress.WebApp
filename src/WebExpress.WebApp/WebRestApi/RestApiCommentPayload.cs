using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents the body of a create / update comment request.
    /// </summary>
    public class RestApiCommentPayload
    {
        /// <summary>
        /// Gets or sets the HTML body of the comment.
        /// </summary>
        [JsonPropertyName("body")]
        public string Body { get; set; }

        /// <summary>
        /// Gets or sets the category id.
        /// </summary>
        [JsonPropertyName("category")]
        public string Category { get; set; }

        /// <summary>
        /// Gets or sets the labels attached to the comment.
        /// </summary>
        [JsonPropertyName("labels")]
        public IEnumerable<string> Labels { get; set; }
    }
}
