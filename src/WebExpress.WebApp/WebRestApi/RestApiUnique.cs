using System;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebRestApi;
using WebExpress.WebCore.WebStatusPage;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Abstract class providing CRUD list responses for REST API.
    /// Produces a flat "items" array suitable for the ListCtrl frontend.
    /// </summary>
    public abstract class RestApiUnique : IRestApi
    {
        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        protected RestApiUnique()
        {
        }

        /// <summary>
        /// Processing of the resource that was called via the get request.
        /// Returns a list-shaped payload with items, title and pagination.
        /// </summary>
        /// <param name="request">The request.</param>
        /// <returns>The response containing the result of the operation.</returns>
        [Method(RequestMethod.GET)]
        public virtual IResponse GetData(Request request)
        {
            // read value parameter
            var value = request.GetParameter("v")?.Value?.ToLower()
                         ?? string.Empty;
            try
            {
                if (string.IsNullOrEmpty(value))
                {
                    return new RestApiUniqueResult()
                    {
                        Available = false
                    }
                        .ToResponse();
                }

                return new RestApiUniqueResult()
                {
                    Available = CheckAvailable(value, request)
                }
                    .ToResponse();
            }
            catch (Exception ex)
            {
                return new ResponseBadRequest(new StatusMessage($"Error processing request.{ex}"));
            }
        }

        /// <summary>
        /// Determines whether the specified value is available based on the provided request context.
        /// </summary>
        /// <param name="value">
        /// The value to check for availability.
        /// </param>
        /// <param name="request">
        /// The request context containing additional information for the availability check. 
        /// </param>
        /// <returns>True if the specified value is available; otherwise, false.</returns>
        protected abstract bool CheckAvailable(string value, Request request);
    }
}