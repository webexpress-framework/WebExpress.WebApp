using System;
using System.Linq;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebStatusPage;
using WebExpress.WebIndex;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Abstract class providing CRUD list responses for REST API.
    /// Produces a flat "items" array suitable for the ListCtrl frontend.
    /// </summary>
    /// <typeparam name="TIndexItem">Type of the index item.</typeparam>
    public abstract class RestApiCrudUnique<TIndexItem> : RestApiCrud<TIndexItem>
        where TIndexItem : IIndexItem
    {
        /// <summary>
        /// Returns or sets the title associated with the current object.
        /// </summary>
        public string Title { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        protected RestApiCrudUnique()
        {
            // read title attribute once
            Title = GetType().CustomAttributes
                .Where(x => x != null && x.AttributeType == typeof(TitleAttribute))
                .Select(x => x.ConstructorArguments.FirstOrDefault().Value?.ToString())
                .FirstOrDefault();
        }

        /// <summary>
        /// Processing of the resource that was called via the get request.
        /// Returns a list-shaped payload with items, title and pagination.
        /// </summary>
        /// <param name="request">The request.</param>
        /// <returns>The response containing the result of the operation.</returns>
        public override Response GetData(Request request)
        {
            // read value parameter
            var value = request.GetParameter("value")?.Value?.ToLower()
                         ?? string.Empty;
            try
            {
                if (string.IsNullOrEmpty(value))
                {
                    return new RestApiCrudUniqueResult<TIndexItem>()
                    {
                        Available = false
                    }
                        .ToResponse();
                }

                return new RestApiCrudUniqueResult<TIndexItem>()
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