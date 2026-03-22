using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using WebExpress.WebApp.WebAttribute;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebRestApi;
using WebExpress.WebCore.WebStatusPage;
using WebExpress.WebIndex;
using WebExpress.WebIndex.Queries;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Abstract class providing quickfilter responses for REST API.
    /// </summary>
    /// <typeparam name="TIndexItem">Type of the index item.</typeparam>
    public abstract class RestApiQuickfilter<TIndexItem> : IRestApi
        where TIndexItem : IIndexItem
    {
        private readonly PropertyInfo _cachedNameAttribute;

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        protected RestApiQuickfilter()
        {
            _cachedNameAttribute = typeof(TIndexItem)
                .GetProperties()
                .FirstOrDefault(prop => Attribute.IsDefined(prop, typeof(RestTextAttribute)));
        }

        /// <summary>
        /// Processing of the resource that was called via the get request.
        /// Returns a list-shaped payload with items, title and pagination.
        /// </summary>
        /// <param name="request">The request.</param>
        /// <returns>The response containing the result of the operation.</returns>
        [Method(RequestMethod.GET)]
        public IResponse Retrieve(IRequest request)
        {
            try
            {
                using var context = CreateContext();
                var items = Retrieve(context, request)
                    .Select(item =>
                    {
                        return new RestApiQuickfilterItem<TIndexItem>()
                        {
                            Id = item.Id.ToString(),
                            Name = _cachedNameAttribute?.GetValue(item)?.ToString() ?? item.Id.ToString(),
                        };
                    });

                var result = new RestApiQuickfilterResult<TIndexItem>()
                {
                    Items = items
                };

                return result.ToResponse();
            }
            catch (Exception ex)
            {
                return new ResponseBadRequest(new StatusMessage($"Error processing request.{ex}"));
            }
        }

        /// <summary>
        /// Creates a new instance of an object that implements the IQueryContext interface.
        /// </summary>
        /// <returns>
        /// An IQueryContext instance that can be used to execute queries.
        /// </returns>
        protected virtual IQueryContext CreateContext()
        {
            return new DefaultQueryContext();
        }

        /// <summary>
        /// Retrieves a queryable collection of index items.
        /// </summary>
        /// <param name="context">
        /// The context in which the query is executed. Provides additional information or constraints 
        /// for the retrieval operation. Cannot be null.
        /// </param>
        /// <param name="request">
        /// The request that provides the operational context.
        /// </param>
        /// <returns>
        /// A collection representing the filtered set of index items. 
        /// The collection may be empty if no items match the query.
        /// </returns>
        protected abstract IEnumerable<TIndexItem> Retrieve(IQueryContext context, IRequest request);

    }
}