using System.Text.Json.Serialization;
using WebExpress.WebIndex;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a quickfilter item in a REST API operation.
    /// </summary>
    /// <typeparam name="TIndexItem">
    /// The type of the index item associated with this quickfilter item.
    /// </typeparam>
    public class RestApiQuickfilterItem<TIndexItem>
        where TIndexItem : IIndexItem
    {
        /// <summary>
        /// Returns or sets the item id.
        /// </summary>
        [JsonPropertyName("id")]
        public string Id { get; set; }

        /// <summary>
        /// Returns or sets the name associated with the quickfilter.
        /// </summary>
        [JsonPropertyName("name")]
        public string Name { get; set; }
    }
}
