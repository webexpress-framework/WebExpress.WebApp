using System.Collections.Generic;
using System.Text;
using System.Text.Json;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebRestApi;
using WebExpress.WebIndex;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents the result of a REST API operation that retrieves a 
    /// paginated tile items.
    /// </summary>
    /// <typeparam name="TIndexItem">The type of the items in the tile.</typeparam>
    public class RestApiTileResult<TIndexItem> : IRestApiResult
         where TIndexItem : IIndexItem
    {
        private readonly JsonSerializerOptions _jsonOptions = new() { WriteIndented = true };

        /// <summary>
        /// Gets or sets the title associated with the object.
        /// </summary>
        public string Title { get; set; }

        /// <summary>
        /// Gets or sets the collection of items associated with the tile.
        /// </summary>
        public IEnumerable<RestApiTileItem> Items { get; set; }

        /// <summary>
        /// Gets or sets the pagination information for the current API request.
        /// </summary>
        public RestApiPaginationInfo Pagination { get; set; }

        /// <summary>
        /// Converts the current instance into a response object.
        /// </summary>
        /// <returns>A Response object representing the result of the conversion.</returns>
        public virtual IResponse ToResponse()
        {
            var data = new
            {
                title = Title,
                items = Items,
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
