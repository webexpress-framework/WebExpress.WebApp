using System.Text;
using System.Text.Json;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebIndex;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents the retrieve (single) result of a REST API CRUD operation.
    /// </summary>
    /// <typeparam name="TIndexItem">
    /// The type of items contained in the result. Must implement <see cref="IIndexItem"/>.
    /// </typeparam>
    public class RestApiCrudResultRetrieve<TIndexItem> : RestApiCrudResult
        where TIndexItem : IIndexItem
    {
        private static readonly JsonSerializerOptions _jsonOptions = new()
        {
            WriteIndented = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        /// <summary>
        /// Returns or sets the item.
        /// </summary>
        public TIndexItem Data { get; set; }

        /// <summary>
        /// Returns or sets the prolog for the item.
        /// </summary>
        public string Prolog { get; set; }

        /// <summary>
        /// Converts the current instance into a <see cref="Response"/> object.
        /// </summary>
        /// <returns>
        /// A Response object representing the result of the conversion.
        /// </returns>
        public override Response ToResponse()
        {
            string jsonData;

            if (string.IsNullOrWhiteSpace(Prolog))
            {
                jsonData = JsonSerializer.Serialize(Data, _jsonOptions);
            }
            else
            {
                jsonData = JsonSerializer.Serialize(new
                {
                    data = Data,
                    prolog = Prolog
                }, _jsonOptions);
            }

            var content = Encoding.UTF8.GetBytes(jsonData);

            return new ResponseOK
            {
                Content = content
            }
                .AddHeaderContentType("application/json");
        }
    }
}
