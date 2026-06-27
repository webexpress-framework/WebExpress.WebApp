namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents the payload for updating the assignment and estimation of a
    /// backlog item in a REST API request.
    /// </summary>
    public class RestApiScrumItemPayload
    {
        /// <summary>
        /// Gets or sets the id of the person the item is assigned to. An empty or
        /// <see langword="null"/> value unassigns the item.
        /// </summary>
        public string AssigneeId { get; set; }

        /// <summary>
        /// Gets or sets the story-point estimate. When <see langword="null"/> the
        /// existing estimate is left unchanged.
        /// </summary>
        public int? Points { get; set; }
    }
}
