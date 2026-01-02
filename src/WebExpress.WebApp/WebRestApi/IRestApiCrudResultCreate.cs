using WebExpress.WebCore.WebRestApi;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents the create result of a REST API CRUD operation.
    /// </summary>
    public interface IRestApiCrudResultCreate : IRestApiResult
    {
        /// <summary>
        /// Returns the item.
        /// </summary>
        object Data { get; }

        /// <summary>
        /// Returns the server‑provided message returned after a 
        /// create operation.
        /// </summary>
        string Message { get; }
    }
}
