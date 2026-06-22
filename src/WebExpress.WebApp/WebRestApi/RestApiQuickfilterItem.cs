using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Describes one quick-filter option in the data returned by a REST API.
    /// </summary>
    public class RestApiQuickfilterItem
    {
        /// <summary>
        /// Gets or sets the item id.
        /// </summary>
        [JsonPropertyName("id")]
        public string Id { get; set; }

        /// <summary>
        /// Gets or sets the name associated with the quickfilter.
        /// </summary>
        [JsonPropertyName("name")]
        public string Name { get; set; }
    }
}
