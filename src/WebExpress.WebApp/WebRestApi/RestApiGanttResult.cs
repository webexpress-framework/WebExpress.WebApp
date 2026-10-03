using System.Collections.Generic;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebRestApi;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents the result of a gantt board GET request, carrying the whole
    /// project as the tasks and links the client renders.
    /// </summary>
    public class RestApiGanttResult : IRestApiResult
    {
        private readonly JsonSerializerOptions _jsonOptions = new()
        {
            WriteIndented = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
        };

        /// <summary>
        /// Gets or sets the title associated with the plan.
        /// </summary>
        public string Title { get; set; }

        /// <summary>
        /// Gets or sets the tasks of the project.
        /// </summary>
        [JsonPropertyName("tasks")]
        public IEnumerable<RestApiGanttTask> Tasks { get; set; }

        /// <summary>
        /// Gets or sets the dependency links of the project.
        /// </summary>
        [JsonPropertyName("links")]
        public IEnumerable<RestApiGanttLink> Links { get; set; }

        /// <summary>
        /// Converts the current instance into a response.
        /// </summary>
        /// <returns>A response representing the project.</returns>
        public virtual IResponse ToResponse()
        {
            var data = new
            {
                title = Title,
                tasks = Tasks ?? [],
                links = Links ?? []
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
