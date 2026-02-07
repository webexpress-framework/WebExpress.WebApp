using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebRestApi;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Defines a contract for RESTful CRUD (Create, Read, Update, Delete) operations on 
    /// a collection of indexed items.
    /// </summary>
    public interface IRestApiCrud : IRestApi
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
