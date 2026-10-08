using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Defines the working days used to calculate task effort independently of
    /// the calendar span displayed by a Gantt chart.
    /// </summary>
    public class RestApiGanttCalendar
    {
        /// <summary>
        /// Gets or sets the working weekdays using Sunday as zero. At least one
        /// weekday must be available; the client defaults to Monday through Friday.
        /// </summary>
        [JsonPropertyName("workingDays")]
        public int[] WorkingDays { get; set; } = [1, 2, 3, 4, 5];

        /// <summary>
        /// Gets or sets non-working dates in yyyy-MM-dd format. The application
        /// supplies regional holidays and project-specific closures explicitly.
        /// </summary>
        [JsonPropertyName("holidays")]
        public string[] Holidays { get; set; } = [];
    }
}
