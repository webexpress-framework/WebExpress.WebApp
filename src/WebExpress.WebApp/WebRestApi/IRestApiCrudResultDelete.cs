using WebExpress.WebCore.WebRestApi;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents the delete result of a REST API CRUD operation.
    /// </summary>
    public interface IRestApiCrudResultDelete : IRestApiResult
    {
        /// <summary>
        /// Returns or sets the server‑provided message returned after a 
        /// delete operation.
        /// </summary>
        string Message { get; set; }

        /// <summary>
        /// Returns or sets a value indicating whether the form should 
        /// be hidden from view.
        /// </summary>
        bool HideForm { get; set; }
    }
}
