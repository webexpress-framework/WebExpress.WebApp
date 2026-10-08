using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// The answer of the type administration endpoint. The two counts are the
    /// caption of the surface ("7 active, 8 defined") and are answered next to
    /// the items rather than derived from them, so they stay correct while the
    /// table is filtered.
    /// </summary>
    public class RestApiRelationTypeResult
    {
        /// <summary>
        /// Gets or sets the administered types.
        /// </summary>
        [JsonPropertyName("items")]
        public IEnumerable<RestApiRelationTypeItem> Items { get; set; }

        /// <summary>
        /// Gets or sets the number of defined types.
        /// </summary>
        [JsonPropertyName("total")]
        public int Total { get; set; }

        /// <summary>
        /// Gets or sets the number of types that may currently be used.
        /// </summary>
        [JsonPropertyName("active")]
        public int Active { get; set; }

        /// <summary>
        /// Gets or sets the classes a type may accept as a target, which the
        /// editor renders as the class checkboxes.
        /// </summary>
        [JsonPropertyName("classes")]
        public IEnumerable<RestApiRelationClassItem> Classes { get; set; }
    }
}
