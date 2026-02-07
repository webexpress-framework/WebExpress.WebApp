using WebExpress.WebCore.WebRestApi;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents the retrieve (single) result of a REST API CRUD operation.
    /// </summary>
    public interface IRestApiCrudResultRetrieve : IRestApiResult
    {
        /// <summary>
        /// Returns or sets the item.
        /// </summary>
        object Data { get; }

        /// <summary>
        /// Returns or sets the title.
        /// </summary>
        string Title { get; }

        /// <summary>
        /// Returns or sets the prolog for the item.
        /// </summary>
        string Prolog { get; }
    }
}
