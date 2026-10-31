using WebExpress.WebCore.WebRestApi;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Contract for the result returned after a REST API delete (CRUD) operation.
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
