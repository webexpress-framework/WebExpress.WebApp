using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a single tab within a form structure. Each tab carries a tree
    /// of nodes (fields and groups).
    /// </summary>
    public class RestApiFormEditorTabItem
    {
        /// <summary>
        /// Gets or sets the unique identifier of the tab.
        /// </summary>
        [JsonPropertyName("id")]
        public string Id { get; set; }

        /// <summary>
        /// Gets or sets the user-visible name of the tab.
        /// </summary>
        [JsonPropertyName("name")]
        public string Name { get; set; }

        /// <summary>
        /// Gets or sets the ordered list of top-level nodes inside the tab.
        /// </summary>
        [JsonPropertyName("children")]
        public IEnumerable<RestApiFormEditorNodeItem> Children { get; set; }
    }
}
