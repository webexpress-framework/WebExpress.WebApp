using System.Text;
using System.Text.Json;
using WebExpress.WebCore.WebMessage;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents the retrieve (single) result for deletion of a REST API CRUD operation.
    /// </summary>
    public class RestApiCrudResultRetrieveDelete : RestApiCrudResultRetrieve, IRestApiCrudResultRetrieveDelete
    {
        private static readonly JsonSerializerOptions _jsonOptions = new()
        {
            WriteIndented = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        /// <summary>
        /// Gets or sets the confirmation item for the delete prompt.
        /// </summary>
        public string ConfirmItem { get; set; }

        /// <summary>
        /// Converts the current instance into a <see cref="Response"/> object.
        /// </summary>
        /// <returns>
        /// A Response object representing the result of the conversion.
        /// </returns>
        public override Response ToResponse()
        {
            var jsonData = JsonSerializer.Serialize(new
            {
                data = Data,
                title = Title,
                prolog = Prolog,
                confirmItem = ConfirmItem
            }, _jsonOptions);

            var content = Encoding.UTF8.GetBytes(jsonData);

            return new ResponseOK
            {
                Content = content
            }
                .AddHeaderContentType("application/json");
        }
    }
}
