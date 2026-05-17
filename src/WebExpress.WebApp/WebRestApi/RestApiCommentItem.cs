using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a single threaded comment as exposed by the REST API and
    /// rendered by the client-side <c>webexpress.webapp.CommentCtrl</c>.
    /// </summary>
    public class RestApiCommentItem
    {
        /// <summary>
        /// Gets or sets the unique identifier of the comment.
        /// </summary>
        [JsonPropertyName("id")]
        public string Id { get; set; }

        /// <summary>
        /// Gets or sets the id of the comment's author.
        /// </summary>
        [JsonPropertyName("author")]
        public string Author { get; set; }

        /// <summary>
        /// Gets or sets the category id (e.g. <c>general</c>, <c>question</c>,
        /// <c>hint</c>, <c>status</c>, <c>decision</c>, <c>solution</c>).
        /// </summary>
        [JsonPropertyName("category")]
        public string Category { get; set; }

        /// <summary>
        /// Gets or sets the free-form labels attached to the comment.
        /// </summary>
        [JsonPropertyName("labels")]
        public IEnumerable<string> Labels { get; set; }

        /// <summary>
        /// Gets or sets the HTML body of the comment.
        /// </summary>
        [JsonPropertyName("body")]
        public string Body { get; set; }

        /// <summary>
        /// Gets or sets the formatted timestamp displayed next to the author.
        /// </summary>
        [JsonPropertyName("when")]
        public string When { get; set; }

        /// <summary>
        /// Gets or sets the ids of users who liked this comment.
        /// </summary>
        [JsonPropertyName("likes")]
        public IEnumerable<string> Likes { get; set; }

        /// <summary>
        /// Gets or sets the reaction map. The key is the emoji glyph, the
        /// value the collection of user ids who reacted with it.
        /// </summary>
        [JsonPropertyName("reactions")]
        public IDictionary<string, IEnumerable<string>> Reactions { get; set; }

        /// <summary>
        /// Gets or sets the flat list of replies.
        /// </summary>
        [JsonPropertyName("replies")]
        public IEnumerable<RestApiCommentReply> Replies { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether the comment is pinned to
        /// the top of the list regardless of sort order.
        /// </summary>
        [JsonPropertyName("pinned")]
        public bool Pinned { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether the comment has been
        /// edited after it was first posted.
        /// </summary>
        [JsonPropertyName("edited")]
        public RestApiCommentEditInfo Edited { get; set; }
    }
}
