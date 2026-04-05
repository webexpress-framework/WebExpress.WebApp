using System.Collections.Generic;
using System.Text;
using System.Text.Json;
using WebExpress.WebCore.WebMessage;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents the retrieve (many) result of a REST API retrieve operation
    /// that returns a collection of items.
    /// </summary>
    public class RestApiCrudResultRetrieveMany : RestApiCrudResult
    {
        private static readonly JsonSerializerOptions _jsonOptions = new()
        {
            WriteIndented = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        /// <summary>
        /// Returns or sets the collection of retrieved items.
        /// </summary>
        public IEnumerable<object> Data { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        public RestApiCrudResultRetrieveMany()
        {
        }

        /// <summary>
        /// Converts the current instance into a <see cref="Response"/> object.
        /// </summary>
        public override Response ToResponse()
        {
            var jsonData = JsonSerializer.Serialize(Data, _jsonOptions);
            var content = Encoding.UTF8.GetBytes(jsonData);

            return new ResponseOK
            {
                Content = content
            }
            .AddHeaderContentType("application/json");
        }
    }
}