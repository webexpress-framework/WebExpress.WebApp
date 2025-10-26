using System.Collections.Generic;
using System.Text.Json.Serialization;
using WebExpress.WebIndex;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a list item in a REST API CRUD operation, with support for customizable 
    /// display properties and options.
    /// </summary>
    /// <typeparam name="TIndexItem">
    /// The type of the index item associated with this list item.
    /// </typeparam>
    public class RestApiCrudListItem<TIndexItem>
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
        public IEnumerable<RestApiCrudOption> Options { get; set; }
    }
}
