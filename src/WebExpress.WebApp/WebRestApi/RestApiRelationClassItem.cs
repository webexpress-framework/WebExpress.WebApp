using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// One class an object of the application may have, as offered by the type
    /// editor when a relation is narrowed to certain targets. The catalog comes
    /// from the endpoint rather than from the client, because only the
    /// application knows which classes it holds.
    /// </summary>
    public class RestApiRelationClassItem
    {
        /// <summary>
        /// Gets or sets the id of the class, which is what a type stores in its
        /// target class list.
        /// </summary>
        [JsonPropertyName("id")]
        public string Id { get; set; }

        /// <summary>
        /// Gets or sets the display name of the class.
        /// </summary>
        [JsonPropertyName("label")]
        public string Label { get; set; }
    }
}
