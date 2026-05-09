namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a Scrum sprint entity as used in REST API operations, 
    /// encapsulating identifying and descriptive information about a sprint.
    /// </summary>
    public class RestApiScrumSprintItem
    {
        /// <summary>
        /// Gets or sets the unique identifier for the sprint.
        /// </summary>
        public string Id { get; set; }

        /// <summary>
        /// Gets or sets the name associated with the sprint.
        /// </summary>
        public string Name { get; set; }

        /// <summary>
        /// Gets or sets the goal associated with the current sprint.
        /// </summary>
        public string Goal { get; set; }

        /// <summary>
        /// Gets or sets the current status of the sprint.
        /// </summary>
        public string Status { get; set; }

        /// <summary>
        /// Gets or sets the start value.
        /// </summary>
        public string Start { get; set; }

        /// <summary>
        /// Gets or sets the end value or marker associated with the 
        /// current sprint.
        /// </summary>
        public string End { get; set; }

        /// <summary>
        /// Gets or sets the total number of elements that the collection 
        /// can hold without resizing.
        /// </summary>
        public int Capacity { get; set; }
    }
}
