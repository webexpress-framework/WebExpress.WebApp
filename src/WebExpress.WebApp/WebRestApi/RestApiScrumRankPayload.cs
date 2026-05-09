namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents the payload for ranking an item within a sprint in a 
    /// REST API request.
    /// </summary>
    public class RestApiScrumRankPayload
    {
        /// <summary>
        /// Gets or sets the unique identifier of the sprint associated 
        /// with this entity.
        /// </summary>
        public string SprintId { get; set; }

        /// <summary>
        /// Gets or sets the rank associated with the entity.
        /// </summary>
        public int? Rank { get; set; }
    }
}
