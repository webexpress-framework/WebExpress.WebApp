using System.Text.Json.Serialization;
using WebExpress.WebCore.WebHtml;

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
        /// Gets or sets the body of the reply, shown as html.
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
        /// Gets or sets the formatted timestamp displayed next to the author.
        /// </summary>
        [JsonPropertyName("when")]
        public string When { get; set; }
    }
}
