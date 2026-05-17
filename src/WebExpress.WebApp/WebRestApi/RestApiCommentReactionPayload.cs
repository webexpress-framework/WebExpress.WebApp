using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents the body of a toggle-reaction request issued by the
    /// comment control.
    /// </summary>
    public class RestApiCommentReactionPayload
    {
        /// <summary>
        /// Gets or sets the emoji glyph being toggled.
        /// </summary>
        [JsonPropertyName("emoji")]
        public string Emoji { get; set; }

        /// <summary>
        /// Gets or sets the user id performing the reaction. The JS
        /// controller forwards <c>data-current-user</c> here.
        /// </summary>
        [JsonPropertyName("userId")]
        public string UserId { get; set; }
    }
}
