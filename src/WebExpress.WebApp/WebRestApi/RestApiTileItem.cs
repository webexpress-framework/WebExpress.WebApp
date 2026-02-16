using System.Collections.Generic;
using System.Text.Json.Serialization;
using WebExpress.WebIndex;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a tile item in a REST API operation, with support for customizable 
    /// display properties and options.
    /// </summary>
    /// <typeparam name="TIndexItem">
    /// The type of the index item associated with this tile item.
    /// </typeparam>
    public class RestApiTileItem<TIndexItem>
        where TIndexItem : IIndexItem
    {
        /// <summary>
        /// Returns or sets the item id.
        /// </summary>
        [JsonPropertyName("id")]
        public string Id { get; set; }

        /// <summary>
        /// Returns or sets the primary display text.
        /// </summary>
        [JsonPropertyName("text")]
        public string Text { get; set; }

        /// <summary>
        /// Returns or sets the content.
        /// </summary>
        [JsonPropertyName("content")]
        public string Content { get; set; }

        /// <summary>
        /// Returns or sets the target uri for the item.
        /// </summary>
        [JsonPropertyName("uri")]
        public string Uri { get; set; }

        /// <summary>
        /// Returns or sets an optional icon css class.
        /// </summary>
        [JsonPropertyName("icon")]
        public string Icon { get; set; }

        /// <summary>
        /// Returns or sets an optional image url.
        /// </summary>
        [JsonPropertyName("image")]
        public string Image { get; set; }

        /// <summary>
        /// Returns or sets the item associated with the index.
        /// </summary>
        [JsonPropertyName("item")]
        public TIndexItem Item { get; set; }

        /// <summary>
        /// Returns or sets optional per-item options (edit/delete etc.).
        /// </summary>
        [JsonPropertyName("options")]
        public IEnumerable<IDictionary<string, object>> Options { get; set; }

        /// <summary>
        /// Returns or sets the primary action.
        /// </summary>
        [JsonPropertyName("primaryAction")]
        public IDictionary<string, object> PrimaryAction { get; set; }

        /// <summary>
        /// Returns or sets the secondary action.
        /// </summary>
        [JsonPropertyName("secondaryAction")]
        public IDictionary<string, object> SecondaryAction { get; set; }

        /// <summary>
        /// Returns or sets the data source identifier used for binding 
        /// operations.
        /// </summary>
        [JsonPropertyName("bind")]
        public IDictionary<string, object> Bind { get; set; }

    }
}
