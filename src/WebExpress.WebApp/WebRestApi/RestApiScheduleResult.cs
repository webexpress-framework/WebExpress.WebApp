using System.Collections.Generic;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebRestApi;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents the period a REST API delivers to the schedule.
    /// </summary>
    public class RestApiScheduleResult : IRestApiResult
    {
        private readonly JsonSerializerOptions _jsonOptions = new()
        {
            WriteIndented = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        /// <summary>
        /// Gets or sets the items of the requested period.
        /// </summary>
        [JsonPropertyName("items")]
        public IEnumerable<RestApiScheduleItem> Items { get; set; }

        /// <summary>
        /// Gets or sets the holidays of the requested period. A schedule that
        /// takes its holidays from a separate endpoint leaves this empty.
        /// </summary>
        [JsonPropertyName("holidays")]
        public IEnumerable<RestApiScheduleHoliday> Holidays { get; set; }

        /// <summary>
        /// Converts the current instance into a <see cref="IResponse"/> object.
        /// </summary>
        /// <returns>
        /// A response object representing the result of the conversion.
        /// </returns>
        public virtual IResponse ToResponse()
        {
            var data = new
            {
                items = Items ?? [],
                holidays = Holidays ?? []
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
