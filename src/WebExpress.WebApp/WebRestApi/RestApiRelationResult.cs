using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// The answer of the link endpoint for one object. Next to the groups of the
    /// requested category it carries the counts of both categories, because the
    /// surface renders the object and the external tab side by side and each has
    /// to show its number even while the other one is displayed.
    /// </summary>
    public class RestApiRelationResult
    {
        /// <summary>
        /// Gets or sets the grouped links of the requested category.
        /// </summary>
        [JsonPropertyName("groups")]
        public IEnumerable<RestApiRelationGroup> Groups { get; set; }

        /// <summary>
        /// Gets or sets the number of links in the requested category.
        /// </summary>
        [JsonPropertyName("total")]
        public int Total { get; set; }

        /// <summary>
        /// Gets or sets the number of links to other objects, across both
        /// categories filters.
        /// </summary>
        [JsonPropertyName("objectCount")]
        public int ObjectCount { get; set; }

        /// <summary>
        /// Gets or sets the number of links to external addresses.
        /// </summary>
        [JsonPropertyName("externalCount")]
        public int ExternalCount { get; set; }
    }
}
