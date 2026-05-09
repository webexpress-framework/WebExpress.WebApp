namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents the payload for a sprint entity in a REST API, 
    /// containing identifying and descriptive information such 
    /// as ID, name, goal, status, time boundaries, and capacity.
    /// </summary>
    public class RestApiSprintPayload
    {
        /// <summary>
        /// Gets or sets the unique identifier for the entity.
        /// </summary>
        public string Id { get; set; }

        /// <summary>
        /// Gets or sets the name associated with the object.
        /// </summary>
        public string Name { get; set; }

        /// <summary>
        /// Gets or sets the goal associated with the current context.
        /// </summary>
        public string Goal { get; set; }

        /// <summary>
        /// Gets or sets the current status of the operation.
        /// </summary>
        public string Status { get; set; }

        /// <summary>
        /// Gets or sets the start value.
        /// </summary>
        public string Start { get; set; }

        /// <summary>
        /// Gets or sets the end value as a string.
        /// </summary>
        public string End { get; set; }

        /// <summary>
        /// Gets or sets the maximum capacity value.
        /// </summary>
        public int? Capacity { get; set; }
    }
}
