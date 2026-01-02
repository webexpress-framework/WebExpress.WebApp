using WebExpress.WebCore.WebRestApi;
using WebExpress.WebIndex;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents the retrieve (single) result of a REST API CRUD operation.
    /// </summary>
    /// <typeparam name="TIndexItem">
    /// The type of items contained in the result. Must implement <see cref="IIndexItem"/>.
    /// </typeparam>
    public interface IRestApiCrudResultRetrieve<TIndexItem> : IRestApiResult
        where TIndexItem : IIndexItem
    {
        /// <summary>
        /// Returns or sets the item.
        /// </summary>
        TIndexItem Data { get; }

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
