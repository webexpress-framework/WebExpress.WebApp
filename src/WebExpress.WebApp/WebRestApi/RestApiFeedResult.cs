using System.Collections.Generic;
using System.Text;
using System.Text.Json;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebRestApi;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents the result of a REST API operation that retrieves one page of a feed.
    /// </summary>
    /// <remarks>
    /// The envelope is the one every paged control family reads - <c>items</c> beside a
    /// <c>pagination</c> block - so the client resolves the figures through the shared
    /// <c>webexpress.webapp.pagingOf</c> and a feed endpoint counts its result the same way a
    /// list, a table or a tile does.
    /// </remarks>
    public class RestApiFeedResult : IRestApiResult
    {
        private readonly JsonSerializerOptions _jsonOptions = new() { WriteIndented = true };

        /// <summary>
        /// Gets or sets the title associated with the feed.
        /// </summary>
        public string Title { get; set; }

        /// <summary>
        /// Gets or sets the entries of this page.
        /// </summary>
        public IEnumerable<RestApiFeedItem> Items { get; set; }

        /// <summary>
        /// Gets or sets the pagination information for the current request. The total is what
        /// tells the control whether there is anything left to fetch, and therefore whether the
        /// "more" button is shown at all.
        /// </summary>
        public RestApiPaginationInfo Pagination { get; set; }

        /// <summary>
        /// Converts the current instance into a response object.
        /// </summary>
        /// <returns>A response representing the result of the conversion.</returns>
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
