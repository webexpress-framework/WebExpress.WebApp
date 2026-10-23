using WebExpress.WebCore.WebRestApi;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Contract for the result returned after a REST API update (CRUD) operation.
    /// </summary>
    public interface IRestApiCrudResultUpdate : IRestApiResult
    {
        /// <summary>
        /// Gets or sets the server‑provided message returned after a 
        /// update operation.
        /// </summary>
        string Message { get; set; }
    }
}
