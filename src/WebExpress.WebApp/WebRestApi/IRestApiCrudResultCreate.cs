using WebExpress.WebCore.WebRestApi;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Contract for the result returned after a REST API create (CRUD) operation.
    /// </summary>
    public interface IRestApiCrudResultCreate : IRestApiResult
    {
        /// <summary>
        /// Gets the item.
        /// </summary>
        object Data { get; }

        /// <summary>
        /// Gets the server‑provided message returned after a 
        /// create operation.
        /// </summary>
        string Message { get; }
    }
}
