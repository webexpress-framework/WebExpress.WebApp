using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Captures the metadata of the last edit on a <see cref="RestApiCommentItem"/>.
    /// </summary>
    public class RestApiCommentEditInfo
    {
        /// <summary>
        /// Gets or sets the formatted timestamp of the last edit.
        /// </summary>
        [JsonPropertyName("when")]
        public string When { get; set; }

        /// <summary>
        /// Gets or sets the id of the user who performed the edit.
        /// </summary>
        [JsonPropertyName("by")]
        public string By { get; set; }
    }
}
