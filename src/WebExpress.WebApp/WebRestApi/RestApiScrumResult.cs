using System.Collections.Generic;
using System.Text;
using System.Text.Json;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebRestApi;
using WebExpress.WebIndex;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents the result of a REST API operation that retrieves a list of scrum items.
    /// </summary>
    /// <typeparam name="TIndexScrum">The type of the sprint entries in the scrum.</typeparam>
    /// <typeparam name="TIndexItem">The type of the items in the scrum.</typeparam>
    public class RestApScrumResult<TIndexScrum, TIndexItem> : IRestApiResult
         where TIndexScrum : IIndexItem
         where TIndexItem : IIndexItem
    {
        private readonly JsonSerializerOptions _jsonOptions = new()
        {
            WriteIndented = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        /// <summary>
        /// Gets the collection of sprints associated with the current context.
        /// </summary>
        public IEnumerable<RestApiScrumSprintItem> Sprints { get; set; } = [];

        /// <summary>
        /// Gets the collection of scrum items exposed by the REST API.
        /// </summary>
        public IEnumerable<RestApiScrumItem> Items { get; set; } = [];

        /// <summary>
        /// Converts the current instance into a response object.
        /// </summary>
        /// <returns>
        /// A Response object representing the result of the conversion.
        /// </returns>
        public virtual IResponse ToResponse()
        {
            var data = new
            {
                sprints = Sprints,
                items = Items
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
