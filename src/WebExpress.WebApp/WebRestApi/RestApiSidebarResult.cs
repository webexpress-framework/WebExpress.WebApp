using System.Collections.Generic;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebRestApi;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents the result of a sidebar retrieval returned by a REST API. It
    /// serializes the navigation tree into the { items: [...] } envelope the
    /// client sidebar model reads, with the camel case policy so the C# property
    /// names reach the client as their lower case field names and null members
    /// stay out of the payload.
    /// </summary>
    public class RestApiSidebarResult : IRestApiResult
    {
        private readonly JsonSerializerOptions _jsonOptions = new()
        {
            WriteIndented = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
        };

        /// <summary>
        /// Gets or sets the top level navigation items.
        /// </summary>
        public IEnumerable<RestApiSidebarItem> Items { get; set; }

        /// <summary>
        /// Converts the current instance into a <see cref="IResponse"/> object.
        /// </summary>
        /// <returns>A response object carrying the serialized navigation tree.</returns>
        public virtual IResponse ToResponse()
        {
            var data = new
            {
                items = Items
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
