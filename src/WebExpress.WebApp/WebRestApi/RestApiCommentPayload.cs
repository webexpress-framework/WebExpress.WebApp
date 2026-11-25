using System.Collections.Generic;
using System.Text.Json.Serialization;
using WebExpress.WebCore.WebHtml;

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
        /// <remarks>
        /// The body is user content shown to other users as html, so whatever is set is reduced to
        /// what <see cref="HtmlSanitizer"/> keeps: no script, no event handler, no foreign address.
        /// Sanitizing on every set covers what a client sends, what the application stores and
        /// what it loads back from a store written before the sanitizing existed.
        /// </remarks>
        [JsonPropertyName("body")]
        public string Body
        {
            get => _body;
            set => _body = value is null ? null : HtmlSanitizer.Sanitize(value);
        }

        private string _body;

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
