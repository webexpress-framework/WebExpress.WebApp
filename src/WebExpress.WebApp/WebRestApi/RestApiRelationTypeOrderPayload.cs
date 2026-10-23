using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// The body of the reorder request of the type administration. The whole
    /// order travels rather than a single moved id, because a drag changes the
    /// position of every type below it and one request keeps the server and the
    /// table from disagreeing about the result.
    /// </summary>
    public class RestApiRelationTypeOrderPayload
    {
        /// <summary>
        /// Gets or sets the ids of the types in their new order.
        /// </summary>
        [JsonPropertyName("ids")]
        public IEnumerable<string> Ids { get; set; }
    }
}
