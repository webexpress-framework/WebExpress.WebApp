using System.Text.Json.Serialization;
using WebExpress.WebCore.WebHtml;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents the body of a reply request issued by the comment control.
    /// </summary>
    public class RestApiCommentReplyPayload
    {
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
    }
}
