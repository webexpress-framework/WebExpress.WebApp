using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a holiday a schedule marks, as exposed by a REST API.
    /// </summary>
    public class RestApiScheduleHoliday
    {
        /// <summary>
        /// Gets or sets the day the holiday falls on, as a bare
        /// <c>yyyy-MM-dd</c>. It is a whole day rather than a moment, so it
        /// carries no time and never shifts with the visitor's zone.
        /// </summary>
        [JsonPropertyName("date")]
        public string Date { get; set; }

        /// <summary>
        /// Gets or sets the name of the holiday.
        /// </summary>
        [JsonPropertyName("name")]
        public string Name { get; set; }

        /// <summary>
        /// Gets or sets the region the holiday applies to.
        /// </summary>
        [JsonPropertyName("region")]
        public string Region { get; set; }

        /// <summary>
        /// Gets or sets the kind of the holiday: public, bank, school,
        /// observance or optional, which decides how prominently the day is
        /// marked.
        /// </summary>
        [JsonPropertyName("type")]
        public string Type { get; set; }
    }
}
