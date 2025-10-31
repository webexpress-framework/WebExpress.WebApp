using System.Text;
using System.Text.Json;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebRestApi;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents the result of a CRUD operation in a REST API, with validation details.
    /// </summary>
    /// <remarks>
    /// This class provides functionality to validate the result of a REST API 
    /// operation and convert it into a standardized response format.
    /// </remarks>
    public class RestApiCrudResultValidation : IRestApiResult
    {
        private readonly JsonSerializerOptions _jsonOptions = new() { WriteIndented = true };

        /// <summary>
        /// Returns or sets the collection of items.
        /// </summary>
        public RestApiValidator Validator { get; set; }

        /// <summary>
        /// Converts the current instance into a <see cref="Response"/> object.
        /// </summary>
        /// <returns>A Response object representing the result of the conversion.</returns>
        public virtual Response ToResponse()
        {
            var data = new
            {
                errors = Validator?.Result?.Errors
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
