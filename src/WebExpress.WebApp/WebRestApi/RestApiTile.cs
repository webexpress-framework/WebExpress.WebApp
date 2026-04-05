using System;
using System.Collections.Generic;
using System.Linq;
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
    /// Abstract class providing tile responses for REST API.
    /// Produces a flat "items" array suitable for the TileCtrl frontend.
    /// </summary>
    /// <typeparam name="TIndexItem">Type of the index item.</typeparam>
    public abstract class RestApiTile<TIndexItem> : IRestApi
        where TIndexItem : IIndexItem
    {
        /// <summary>
        /// Returns or sets the title associated with the current object.
        /// </summary>
        public string Title { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        protected RestApiTile()
        {
            // read attributes once
            Title = GetType().CustomAttributes
                .Where(x => x is not null && x.AttributeType == typeof(TitleAttribute))
                .Select(x => x.ConstructorArguments.FirstOrDefault().Value?.ToString())
                .FirstOrDefault();
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
            // read paging and filters; support both "filter" (frontend) and "search" (compat)
            var pageNumber = Convert.ToInt32(request.GetParameter("p")?.Value ?? "0");
            var pageSize = Convert.ToInt32(request.GetParameter("l")?.Value ?? "50");
            var search = request.GetParameter("q")?.Value ?? string.Empty;
            var wql = request.GetParameter("wql")?.Value ?? null;
            var filters = request.GetParameter("f")?.Value?.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries) ?? [];
            var query = new Query<TIndexItem>() as IQuery<TIndexItem>; ;

            try
            {
                if (!string.IsNullOrWhiteSpace(wql))
                {
                    var parser = new WqlParser<TIndexItem>();
                    var wqlStatement = parser.Parse(wql);

                    query = Filter(wqlStatement, query, request);
                }
                else
                {
                    query = Filter(search, query, request);
                }

                // quickfilters
                query = Filter(filters, query, request);

                // paging 
                query = query.WithPaging(pageNumber * pageSize, pageSize);

                using var context = CreateContext();
                var items = RetrieveItems(query, context, request);

                var result = new RestApiTileResult<TIndexItem>()
                {
                    Title = I18N.Translate(request, Title),
                    Items = items,
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
        /// An enumerable collection of tile items that satisfy the query 
        /// criteria. The collection may be empty if no items match.
        /// </returns>
        protected abstract IEnumerable<RestApiTileItem> RetrieveItems(IQuery<TIndexItem> query, IQueryContext context, IRequest request);

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
        /// <returns>
        /// A query representing the filtered set of items that match the criteria defined by 
        /// the WQL statement.
        /// </returns>
        protected virtual IQuery<TIndexItem> Filter(IWqlStatement<TIndexItem> wqlStatement, IQuery<TIndexItem> query, IRequest request)
        {
            if (wqlStatement is null || wqlStatement.HasErrors)
            {
                return query;
            }

            return wqlStatement.ToQuery();
        }

        /// <summary>
        /// Applies the specified filter criteria to the given query object.
        /// </summary>
        /// <param name="search">
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
        /// <returns>
        /// A query representing the filtered set of items that match the criteria defined by 
        /// the filter statement.
        /// </returns>
        protected virtual IQuery<TIndexItem> Filter(string search, IQuery<TIndexItem> query, IRequest request)
        {
            return query;
        }

        /// <summary>
        /// Applies the specified filter criteria to the given query object.
        /// </summary>
        /// <param name="filters">
        /// A collection of quickfilter identifiers that should be applied in addition to the WQL criteria.
        /// </param>
        /// <param name="query">
        /// The query object to which the filter will be applied.
        /// </param>
        /// <param name="request">
        /// The request that provides the operational context for resolving
        /// the appropriate REST API URI.
        /// </param>
        /// <returns>
        /// A query representing the filtered set of items that match the criteria defined by 
        /// the filter statement.
        /// </returns>
        protected virtual IQuery<TIndexItem> Filter(IEnumerable<string> filters, IQuery<TIndexItem> query, IRequest request)
        {
            return query;
        }
    }
}