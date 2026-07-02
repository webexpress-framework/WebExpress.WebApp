using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a gantt task as exchanged with the REST API. The wire shape
    /// separates the data model from the presentation: any two of start, end
    /// and duration suffice, the client derives the third. A task with a zero
    /// duration is a milestone; a task with children is a container whose dates
    /// and progress the client rolls up from its subtree.
    /// </summary>
    public class RestApiGanttTask
    {
        /// <summary>
        /// Gets or sets the unique identifier of the task.
        /// </summary>
        [JsonPropertyName("id")]
        public string Id { get; set; }

        /// <summary>
        /// Gets or sets the display label of the task.
        /// </summary>
        [JsonPropertyName("label")]
        public string Label { get; set; }

        /// <summary>
        /// Gets or sets the start date as an ISO date string (yyyy-mm-dd).
        /// </summary>
        [JsonPropertyName("start")]
        public string Start { get; set; }

        /// <summary>
        /// Gets or sets the end date as an ISO date string (yyyy-mm-dd).
        /// </summary>
        [JsonPropertyName("end")]
        public string End { get; set; }

        /// <summary>
        /// Gets or sets the duration in whole days. A value of zero marks a milestone.
        /// </summary>
        [JsonPropertyName("duration")]
        public int Duration { get; set; }

        /// <summary>
        /// Gets or sets the completion percentage in the range 0..100.
        /// </summary>
        [JsonPropertyName("progress")]
        public int Progress { get; set; }

        /// <summary>
        /// Gets or sets the resources assigned to the task.
        /// </summary>
        [JsonPropertyName("resources")]
        public string[] Resources { get; set; }

        /// <summary>
        /// Gets or sets the id of the container the task belongs to, or null for
        /// a root task.
        /// </summary>
        [JsonPropertyName("parentId")]
        public string ParentId { get; set; }

        /// <summary>
        /// Gets or sets an optional CSS color applied to the task bar.
        /// </summary>
        [JsonPropertyName("color")]
        public string Color { get; set; }

        /// <summary>
        /// Gets or sets an optional icon shown before the task name in the grid
        /// and on the bar, either a CSS icon class (for example "fas fa-ship")
        /// or an image URL.
        /// </summary>
        [JsonPropertyName("icon")]
        public string Icon { get; set; }
    }
}
