using System.Collections.Generic;
using System.Text;
using System.Text.Json;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebRestApi;
using WebExpress.WebIndex;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents the result of a REST API operation, including data and pagination information.
    /// </summary>
    /// <remarks>
    /// This class provides a standardized structure for returning data and pagination 
    /// details from a REST API endpoint. It also includes functionality to convert 
    /// the result into a <see cref="Response"/> object for further processing or transmission.
    /// </remarks>
    /// <typeparam name="TIndexItem">
    /// The type of items contained in the result. Must implement <see cref="IIndexItem"/>.
    /// </typeparam>
    public class RestApiResult<TIndexItem> : IRestApiResult
        where TIndexItem : IIndexItem
    {
        private readonly JsonSerializerOptions _jsonOptions = new()
        {
            WriteIndented = true
        };

        /// <summary>
        /// Gets or sets the collection of items.
        /// </summary>
        public IEnumerable<TIndexItem> Data { get; set; }

        /// <summary>
        /// Gets or sets the pagination information for the current API request.
        /// </summary>
        public RestApiPaginationInfo Pagination { get; set; }

        /// <summary>
        /// Converts the current instance into a <see cref="Response"/> object.
        /// </summary>
        /// <returns>A Response object representing the result of the conversion.</returns>
        public virtual IResponse ToResponse()
        {
            var data = new
            {
                data = Data,
                pagination = Pagination
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
