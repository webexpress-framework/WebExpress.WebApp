using WebExpress.WebIndex;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents the retrieve (single) result of a REST API CRUD operation.
    /// </summary>
    /// <typeparam name="TIndexItem">
    /// The type of items contained in the result. Must implement <see cref="IIndexItem"/>.
    /// </typeparam>
    public interface IRestApiCrudResultRetrieveDelete<TIndexItem> : IRestApiCrudResultRetrieve<TIndexItem>
        where TIndexItem : IIndexItem
    {
        /// <summary>
        /// Returns the confirmation item for the delete prompt.
        /// </summary>
        public string ConfirmItem { get; }
    }
}
