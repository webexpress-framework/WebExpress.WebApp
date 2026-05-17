using WebExpress.WebCore.WebRestApi;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents the delete result of a REST API CRUD operation.
    /// </summary>
    public interface IRestApiCrudResultDelete : IRestApiResult
    {
        /// <summary>
        /// Gets or sets the server‑provided message returned after a 
        /// delete operation.
        /// </summary>
        string Message { get; set; }
    }
}
