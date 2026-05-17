using System.Collections.Generic;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebRestApi;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents the result of a Kanban board REST API operation.
    /// </summary>
    public class RestApiKanbanResult : IRestApiResult
    {
        private readonly JsonSerializerOptions _jsonOptions = new()
        {
            WriteIndented = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        /// <summary>
        /// Gets or sets the title associated with the Kanban board.
        /// </summary>
        public string Title { get; set; }

        /// <summary>
        /// Gets or sets the collection of columns defined for the Kanban board.
        /// </summary>
        [JsonPropertyName("columns")]
        public IEnumerable<RestApiKanbanColumn> Columns { get; set; }

        /// <summary>
        /// Gets or sets the collection of swimlanes associated with the Kanban board.
        /// </summary>
        [JsonPropertyName("swimlanes")]
        public IEnumerable<RestApiKanbanSwimlane> Swimlanes { get; set; }

        /// <summary>
        /// Gets or sets the collection of Kanban cards associated with the Kanban board.
        /// </summary>
        [JsonPropertyName("items")]
        public IEnumerable<RestApiKanbanCard> Cards { get; set; }

        /// <summary>
        /// Converts the current instance into a <see cref="IResponse"/> object.
        /// </summary>
        /// <returns>
        /// A Response object representing the result of the conversion.
        /// </returns>
        public virtual IResponse ToResponse()
        {
            var data = new
            {
                title = Title,
                columns = Columns,
                swimlanes = Swimlanes,
                items = Cards
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
