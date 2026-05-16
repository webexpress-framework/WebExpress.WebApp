using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Describes a comment category as exposed by the REST API and consumed
    /// by the client-side <c>webexpress.webapp.CommentCtrl</c>. The control
    /// requests the categories from <c>GET {base}/categories</c>; the
    /// returned set is used for the toolbar filter, the edit-form picker
    /// and the per-comment accent color.
    /// </summary>
    public class RestApiCommentCategory
    {
        /// <summary>
        /// Gets or sets the stable identifier of the category. This is the
        /// value persisted on <see cref="RestApiCommentItem.Category"/>.
        /// </summary>
        [JsonPropertyName("id")]
        public string Id { get; set; }

        /// <summary>
        /// Gets or sets the i18n key resolved on the client to render the
        /// human-readable label.
        /// </summary>
        [JsonPropertyName("i18n")]
        public string I18n { get; set; }

        /// <summary>
        /// Gets or sets the CSS color used for the foreground of the
        /// category badge (text color of the badge).
        /// </summary>
        [JsonPropertyName("color")]
        public string Color { get; set; }

        /// <summary>
        /// Gets or sets the CSS color used for the background of the
        /// category badge.
        /// </summary>
        [JsonPropertyName("bg")]
        public string Background { get; set; }
    }
}
