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

    /// <summary>
    /// Provides extension methods for the <see cref="RestApiCrudMode"/> enumeration.
    /// </summary>
    public static class RestApiCrudModeExtensions
    {
        /// <summary>
        /// Converts the enumeration value to a string representation.
        /// </summary>
        /// <param name="mode">The mode to convert.</param>
        /// <returns>A string representation of the mode.</returns>
        public static string ToMode(this RestApiCrudMode mode)
        {
            return mode switch
            {
                RestApiCrudMode.Create => "new",
                RestApiCrudMode.Clone => "new",
                RestApiCrudMode.Retrieve => "retrieve",
                RestApiCrudMode.Update => "update",
                RestApiCrudMode.Delete => "delete",
                _ => ""
            };
        }
    }
}