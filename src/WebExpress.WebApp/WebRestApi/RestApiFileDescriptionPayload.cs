using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents the payload received by <see cref="RestApiFile{TIndexItem}.Update"/>
    /// when a description is edited in place in the file view.
    /// </summary>
    public class RestApiFileDescriptionPayload
    {
        /// <summary>
        /// Gets or sets the id of the file whose description changed.
        /// </summary>
        [JsonPropertyName("id")]
        public string Id { get; set; }

        /// <summary>
        /// Gets or sets the new description.
        /// </summary>
        [JsonPropertyName("description")]
        public string Description { get; set; }
    }
}
