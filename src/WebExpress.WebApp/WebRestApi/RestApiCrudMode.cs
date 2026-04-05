namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Specifies the operation mode for a REST API CRUD (create, retrieve, update, delete) action.
    /// </summary>
    public enum RestApiCrudMode
    {
        /// <summary>
        /// Default mode with no specific CRUD behavior assigned.
        /// </summary>
        Default,
        /// <summary>
        /// Creates a new resource.
        /// </summary>
        Create,
        /// <summary>
        /// Creates a new resource by cloning an existing one.
        /// </summary>
        Clone,
        /// <summary>
        /// Retrieves an existing resource.
        /// </summary>
        Retrieve,
        /// <summary>
        /// Updates an existing resource.
        /// </summary>
        Update,
        /// <summary>
        /// Deletes an existing resource.
        /// </summary>
        Delete
    }
}