using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using WebExpress.WebCore.WebMessage;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents the create result of a REST API CRUD operation.
    /// </summary>
    public class RestApiCrudResultCreate : RestApiCrudResult, IRestApiCrudResultCreate
    {
        private static readonly JsonSerializerOptions _jsonOptions = new()
        {
            WriteIndented = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        /// <summary>
        /// Returns or sets the item.
        /// </summary>
        [JsonPropertyName("data")]
        public object Data { get; set; }

        /// <summary>
        /// Returns or sets the server‑provided message returned after a 
        /// create operation.
        /// </summary>
        [JsonPropertyName("message")]
        public string Message { get; set; }

        /// <summary>
        /// Converts the current instance into a <see cref="Response"/> object.
        /// </summary>
        /// <returns>A Response object representing the result of the conversion.</returns>
        public override Response ToResponse()
        {
            var jsonData = JsonSerializer.Serialize(this, _jsonOptions);
            var content = Encoding.UTF8.GetBytes(jsonData);

            return new ResponseOK
            {
                Content = content
            }
                .AddHeaderContentType("application/json");
        }
    }
}
