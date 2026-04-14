using System.Collections.Generic;
using System.Text;
using System.Text.Json;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebRestApi;
using WebExpress.WebIndex;
using WebExpress.WebUI.WebIcon;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents the result of a REST API operation that retrieves avatar dropdown items
    /// grouped by section.
    /// </summary>
    /// <typeparam name="TIndexItem">The type of the items in the list.</typeparam>
    public class RestApiAvatarDropdownResult<TIndexItem> : IRestApiResult
         where TIndexItem : IIndexItem
    {
        private static readonly JsonSerializerOptions _jsonOptions = new() { WriteIndented = true };

        /// <summary>
        /// Gets or sets the user name associated with the current instance.
        /// </summary>
        public string Username { get; set; }

        /// <summary>
        /// Gets or sets the icon image associated with this instance.
        /// </summary>
        public ImageIcon Image { get; set; }

        /// <summary>
        /// Gets or sets the collection of avatar dropdown items.
        /// </summary>
        public IEnumerable<RestApiAvatarDropdownItem> Items { get; set; }

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
                username = Username,
                image = Image?.Uri.ToString(),
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
