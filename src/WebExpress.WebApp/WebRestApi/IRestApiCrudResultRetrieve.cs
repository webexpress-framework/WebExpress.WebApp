using WebExpress.WebCore.WebRestApi;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents the retrieve (single) result of a REST API CRUD operation.
    /// </summary>
    public interface IRestApiCrudResultRetrieve : IRestApiResult
    {
        /// <summary>
        /// Gets or sets the item.
        /// </summary>
        object Data { get; }

        /// <summary>
        /// Gets or sets the title.
        /// </summary>
        string Title { get; }

        /// <summary>
        /// Gets or sets the prolog for the item.
        /// </summary>
        string Prolog { get; }
    }
}
