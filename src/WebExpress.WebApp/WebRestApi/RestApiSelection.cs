using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using WebExpress.WebApp.WebAttribute;
using WebExpress.WebCore;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebRestApi;
using WebExpress.WebCore.WebStatusPage;
using WebExpress.WebIndex;
using WebExpress.WebIndex.Queries;
using WebExpress.WebIndex.Wql;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Abstract base class for selection REST APIs based on indexed items.
    /// </summary>
    /// <typeparam name="TIndexItem">Type of the index item.</typeparam>
    public abstract class RestApiSelection<TIndexItem> : IRestApi
        where TIndexItem : IIndexItem
    {
        private readonly PropertyInfo _cachedNameAttribute;
        private readonly PropertyInfo _cachedUriAttribute;

        /// <summary>
        /// Returns or sets the title associated with the current object.
        /// </summary>
        public string Title { get; protected set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        public RestApiSelection()
        {
            // search for an attribute of type Title and return its value if present
            Title = GetType().CustomAttributes
                .Where(x => x?.AttributeType == typeof(TitleAttribute))
                .Select(x => x.ConstructorArguments.FirstOrDefault().Value?.ToString())
                .FirstOrDefault();

            _cachedNameAttribute = typeof(TIndexItem)
                .GetProperties()
                .Where(prop => Attribute.IsDefined(prop, typeof(RestSelectionTextAttribute)))
                .FirstOrDefault();

            _cachedUriAttribute = typeof(TIndexItem)
                .GetProperties()
                .Where(prop => Attribute.IsDefined(prop, typeof(RestDropdownUriAttribute)))
                .FirstOrDefault();
        }

        /// <summary>
        /// Processes GET requests and returns a paged list of dropdown items.
        /// Supports search via 'q' (search), WQL via 'wql', paging via 'p' and 'p' (pageSize) or 'm' (max).
        /// </summary>
        /// <param name="request">The request.</param>
        /// <returns>The response containing dropdown items and pagination.</returns>
        [Method(RequestMethod.GET)]
        public IResponse Retrieve(IRequest request)
        {
            // default page size aligned with dropdown max entries
            var defaultPageSize = "50";
            var pageNumber = Convert.ToInt32(request.GetParameter("p")?.Value ?? "0");
            var pageSize = Convert.ToInt32(request.GetParameter("l")?.Value ?? defaultPageSize);
            var filter = request.GetParameter("q")?.Value ?? string.Empty;
            var wql = request.GetParameter("wql")?.Value ?? null;
            var query = new Query<TIndexItem>();

            try
            {
                if (!string.IsNullOrWhiteSpace(wql))
                {
                    var wqlStatement = WebEx.ComponentHub
                        .GetComponentManager<WebIndex.IndexManager>()?
                        .Retrieve<TIndexItem>(wql);

                    Filter(wqlStatement, query, request);
                }
                else
                {
                    Filter(filter, query, request);
                }

                // apply paging
                query.WithPaging(pageNumber * pageSize, pageSize);

                using var context = CreateContext();
                var items = Retrieve(query, context, request);

                var result = new RestApiSelectionResult<IIndexItem>()
                {
                    Title = I18N.Translate(request, Title),
                    Items = items.Select(x => new RestApiSelectionItem
                    {
                        Id = x.Id,
                        Text = _cachedNameAttribute?.GetValue(x)?.ToString() ?? x.Id.ToString(),
                        Uri = _cachedUriAttribute?.GetValue(x)?.ToString()
                    }),
                    Pagination = new RestApiPaginationInfo()
                    {
                        PageNumber = pageNumber,
                        PageSize = pageSize,
                        TotalCount = items.Count()
                    }
                };

                return result.ToResponse();
            }
            catch (Exception ex)
            {
                return new ResponseBadRequest(new StatusMessage($"Error processing request. {ex}"));
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
        /// Retrieves a queryable collection of index items that match the specified query criteria.
        /// </summary>
        /// <param name="query">
        /// An object containing the query parameters used to filter and select index items. Cannot 
        /// be null.
        /// </param>
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
        protected abstract IEnumerable<TIndexItem> Retrieve(IQuery<TIndexItem> query, IQueryContext context, IRequest request);

        /// <summary>
        /// Applies filtering criteria to the specified query based on the provided WQL statement.
        /// </summary>
        /// <param name="wqlStatement">
        /// The WQL statement that defines the filtering conditions to apply to the query. Cannot 
        /// be null.
        /// </param>
        /// <param name="query">
        /// The query object to which the filtering criteria will be applied. Cannot be null.
        /// </param>
        /// <param name="request">
        /// The request that provides the operational context for resolving
        /// the appropriate REST API URI.
        /// </param>
        protected virtual void Filter(IWqlStatement wqlStatement, IQuery<TIndexItem> query, IRequest request)
        {
        }

        /// <summary>
        /// Applies the specified filter criteria to the given query object.
        /// </summary>
        /// <param name="filter">
        /// A string representing the filter expression to apply. The format and supported 
        /// operators depend on the implementation.
        /// </param>
        /// <param name="query">
        /// The query object to which the filter will be applied.
        /// </param>
        /// <param name="request">
        /// The request that provides the operational context for resolving
        /// the appropriate REST API URI.
        /// </param>
        protected virtual void Filter(string filter, IQuery<TIndexItem> query, IRequest request)
        {
        }
    }
}
