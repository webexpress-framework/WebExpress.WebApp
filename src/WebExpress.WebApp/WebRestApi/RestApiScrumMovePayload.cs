namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents the payload used to move an entity to a different sprint 
    /// in a REST API context.
    /// </summary>
    public class RestApiScrumMovePayload
    {
        /// <summary>
        /// Gets or sets the unique identifier of the sprint associated 
        /// with this entity.
        /// </summary>
        public string SprintId { get; set; }
    }
}
