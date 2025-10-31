using System.Text.Json.Serialization;
using WebExpress.WebCore.WebUri;
using WebExpress.WebIndex;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents an item in a CRUD dropdown list for a REST API.
    /// </summary>
    public interface IRestApiCrudDropdownItem : IIndexItem
    {
        /// <summary>
        /// Returns the display text of the item.
        /// </summary>
        [JsonPropertyName("text")]
        string Text { get; }

        /// <summary>
        /// Returns the target url/uri for the item.
        /// </summary>
        [JsonPropertyName("uri")]
        IUri Uri { get; }
    }
}
