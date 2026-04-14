namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents the retrieve (single) result of a REST API CRUD operation.
    /// </summary>
    public interface IRestApiCrudResultRetrieveDelete : IRestApiCrudResultRetrieve
    {
        /// <summary>
        /// Gets the confirmation item for the delete prompt.
        /// </summary>
        public string ConfirmItem { get; }
    }
}
