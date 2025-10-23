using System.Text.Json.Serialization;
using WebExpress.WebIndex;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents an item in a CRUD selection control for a REST API.
    /// </summary>
    public interface IRestApiCrudSelectionItem : IIndexItem
    {
        /// <summary>
        /// Returns the display text of the item.
        /// </summary>
        [JsonPropertyName("text")]
        string Text { get; }
    }
}
