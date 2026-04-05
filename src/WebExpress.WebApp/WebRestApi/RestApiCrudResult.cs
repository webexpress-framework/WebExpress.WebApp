using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebRestApi;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents the result of a REST API CRUD operation.
    /// </summary>
    public abstract class RestApiCrudResult : IRestApiResult
    {
        /// <summary>
        /// Converts the current instance into a <see cref="IResponse"/> object.
        /// </summary>
        /// <returns>
        /// A Response object representing the result of the conversion.
        /// </returns>
        public abstract IResponse ToResponse();
    }
}
