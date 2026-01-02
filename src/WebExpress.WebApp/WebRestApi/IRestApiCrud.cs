using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebRestApi;
using WebExpress.WebIndex;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Defines a contract for RESTful CRUD (Create, Read, Update, Delete) operations on 
    /// a collection of indexed items.
    /// </summary>
    /// <typeparam name="TIndexItem">
    /// The type of items in the collection, which must implement the <see cref="IIndexItem"/> 
    /// interface.
    /// </typeparam>
    public interface IRestApiCrud<TIndexItem> : IRestApi
        where TIndexItem : IIndexItem
    {
        /// <summary>
        /// Creates data.
        /// </summary>
        /// <param name="request">The request.</param>
        /// <returns>The response containing the result of the operation.</returns>
        IResponse Create(IRequest request);

        /// <summary>
        /// Processing of the resource that was called via the get request.
        /// </summary>
        /// <param name="request">The request.</param>
        /// <returns>The response containing the result of the operation.</returns>
        IResponse Retrieve(IRequest request);

        /// <summary>
        /// Updates data (EDIT).
        /// Handles HTTP PUT and validates inputs before applying the update.
        /// </summary>
        /// <param name="request">The request.</param>
        /// <returns>The response containing the result of the operation.</returns>
        IResponse Update(IRequest request);

        /// <summary>
        /// Deletes data.
        /// </summary>
        /// <param name="request">The request.</param>
        /// <returns>The response containing the result of the operation.</returns>
        public IResponse Delete(IRequest request);
    }
}
