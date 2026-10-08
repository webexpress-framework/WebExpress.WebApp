using System.Collections.Generic;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebRestApi;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents the graph a REST API delivers to the graph viewer.
    /// </summary>
    public class RestApiGraphResult : IRestApiResult
    {
        private readonly JsonSerializerOptions _jsonOptions = new()
        {
            WriteIndented = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        /// <summary>
        /// Gets or sets the nodes of the graph.
        /// </summary>
        [JsonPropertyName("nodes")]
        public IEnumerable<RestApiGraphNode> Nodes { get; set; }

        /// <summary>
        /// Gets or sets the edges of the graph. An edge whose source or target
        /// is not among the nodes is dropped by the client, because the viewer
        /// cannot draw a connection to a node it does not have.
        /// </summary>
        [JsonPropertyName("edges")]
        public IEnumerable<RestApiGraphEdge> Edges { get; set; }

        /// <summary>
        /// Converts the current instance into a <see cref="IResponse"/> object.
        /// </summary>
        /// <returns>
        /// A response object representing the result of the conversion.
        /// </returns>
        public virtual IResponse ToResponse()
        {
            var data = new
            {
                nodes = Nodes ?? [],
                edges = Edges ?? []
            };

            var jsonData = JsonSerializer.Serialize(data, _jsonOptions);
            var content = Encoding.UTF8.GetBytes(jsonData);

            return new ResponseOK
            {
                Content = content
            }
                .AddHeaderContentType("application/json");
        }
    }
}
