using System.Text;
using System.Text.Json;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebIndex;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents the retrieve (single) result for deletion of a REST API CRUD operation.
    /// </summary>
    /// <typeparam name="TIndexItem">
    /// The type of items contained in the result. Must implement <see cref="IIndexItem"/>.
    /// </typeparam>
    public class RestApiCrudResultRetrieveDelete<TIndexItem> : RestApiCrudResultRetrieve<TIndexItem>, IRestApiCrudResultRetrieveDelete<TIndexItem>
        where TIndexItem : IIndexItem
    {
        private static readonly JsonSerializerOptions _jsonOptions = new()
        {
            WriteIndented = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        /// <summary>
        /// Returns or sets the confirmation item for the delete prompt.
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
