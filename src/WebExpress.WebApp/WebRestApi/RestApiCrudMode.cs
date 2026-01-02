namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Specifies the operation mode for a REST API CRUD (create, retrieve, update, delete) action.
    /// </summary>
    public enum RestApiCrudMode
    {
        /// <summary>
        /// Default mode
        /// </summary>
        Default,
        /// <summary>
        /// Create mode
        /// </summary>
        Create,
        /// <summary>
        /// Retrieve mode
        /// </summary>
        Retrieve,
        /// <summary>
        /// Update mode
        /// </summary>
        Update,
        /// <summary>
        /// Delete mode
        /// </summary>
        Delete
    }
}