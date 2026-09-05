using System;
using System.Collections.Generic;
using System.Linq;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebRestApi;
using WebExpress.WebIndex;
using WebExpress.WebIndex.Queries;
using WebExpress.WebIndex.Wql;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Abstract base for the endpoint behind a <see cref="WebControl.ControlDataFeed"/>: one page
    /// of entries, newest first, that the control appends to what it is already showing.
    /// </summary>
    /// <remarks>
    /// <para>
    /// It reads the same paging parameters as <see cref="RestApiList{TIndexItem}"/> - <c>p</c> for
    /// the page and <c>l</c> for its size - and answers the same envelope, so nothing about
    /// fetching a page differs between the two. What differs is the shape of an entry and what the
    /// client does with a page: a list replaces its rows, a feed appends them.
    /// </para>
    /// <para>
    /// <see cref="RetrieveTotal"/> matters more here than it does for a list. A pager without a
    /// total offers one page and looks merely short; a feed without a total cannot know whether
    /// anything is left, so the control keeps offering "more" until a page comes back smaller than
    /// it asked for. Counting the result gives the reader a button that disappears exactly when it
    /// should.
    /// </para>
    /// </remarks>
    /// <typeparam name="TIndexItem">Type of the index item.</typeparam>
    public abstract class RestApiFeed<TIndexItem> : IRestApi
        where TIndexItem : IIndexItem
    {
        /// <summary>
        /// Gets or sets the title associated with the feed.
        /// </summary>
        public string Title { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        protected RestApiFeed()
        {
            Title = GetType().CustomAttributes
                .Where(x => x is not null && x.AttributeType == typeof(TitleAttribute))
                .Select(x => x.ConstructorArguments.FirstOrDefault().Value?.ToString())
                .FirstOrDefault();
        }

        /// <summary>
        /// Processing of the resource that was called via the get request. Returns one page of
        /// entries together with the size of the whole result.
        /// </summary>
        /// <param name="request">The request.</param>
        /// <returns>The response containing the result of the operation.</returns>
        [Method(RequestMethod.GET)]
        public IResponse Retrieve(IRequest request)
        {
            var pageNumber = request.ParseIntParameter("p", 0);
            var pageSize = request.ParseIntParameter("l", 5);
            var search = request.GetParameter("q")?.Value ?? string.Empty;
            var wql = request.GetParameter("wql")?.Value ?? null;
            var filters = request.GetParameter("f")?.Value?.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries) ?? [];
            var query = new Query<TIndexItem>() as IQuery<TIndexItem>;

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

                query = Filter(filters, query, request);

                using var context = CreateContext();

                // the size of the whole result is asked for before paging narrows the query,
                // because that is the only point at which it can still be counted
                var total = RetrieveTotal(query, context, request);

                query = query.WithPaging(pageNumber * pageSize, pageSize);

                var items = RetrieveItems(query, context, request);

                var result = new RestApiFeedResult()
                {
                    Title = I18N.Translate(request, Title),
                    Items = items,
                    Pagination = new RestApiPaginationInfo()
                    {
                        PageNumber = pageNumber,
                        PageSize = pageSize,

                        // an endpoint that cannot count its result reports the size of the page it
                        // returned; the control then stops offering more once a short page arrives
                        TotalCount = total >= 0 ? total : pageNumber * pageSize + items.Count()
                    }
                };

                return result.ToResponse();
            }
            catch (Exception ex)
            {
                return RestApiFault.BadRequest(request, ex, "Error processing request.");
            }
        }

        /// <summary>
        /// Creates a new instance of an object that implements the IQueryContext interface.
        /// </summary>
        /// <returns>An IQueryContext instance that can be used to execute queries.</returns>
        protected virtual IQueryContext CreateContext()
        {
            return new DefaultQueryContext();
        }

        /// <summary>
        /// Retrieves the entries of the requested page.
        /// </summary>
        /// <param name="query">The query criteria, already narrowed to the requested page.</param>
        /// <param name="context">The context in which the query is executed.</param>
        /// <param name="request">The request that provides the operational context.</param>
        /// <returns>The entries. The collection is empty if no items match.</returns>
        protected abstract IEnumerable<RestApiFeedItem> RetrieveItems(IQuery<TIndexItem> query, IQueryContext context, IRequest request);

        /// <summary>
        /// Returns how many entries the filtered result holds in total, before paging narrows it.
        /// </summary>
        /// <remarks>
        /// Worth implementing: it is what lets the control hide its "more" button on the last
        /// page rather than one page later. See the remarks on the class.
        /// </remarks>
        /// <param name="query">The filtered query, without paging applied.</param>
        /// <param name="context">The context in which the query is executed.</param>
        /// <param name="request">The request that provides the operational context.</param>
        /// <returns>The number of entries in the whole result, or a negative value when the
        /// endpoint does not count it.</returns>
        protected virtual int RetrieveTotal(IQuery<TIndexItem> query, IQueryContext context, IRequest request)
        {
            return -1;
        }

        /// <summary>
        /// Applies filtering criteria to the specified query based on the provided WQL statement.
        /// </summary>
        /// <param name="wqlStatement">The WQL statement defining the filtering conditions.</param>
        /// <param name="query">The query object to which the criteria are applied.</param>
        /// <param name="request">The request that provides the operational context.</param>
        /// <returns>The filtered query.</returns>
        protected virtual IQuery<TIndexItem> Filter(IWqlStatement<TIndexItem> wqlStatement, IQuery<TIndexItem> query, IRequest request)
        {
            if (wqlStatement is null || wqlStatement.HasErrors)
            {
                return query;
            }

            return wqlStatement.ToQuery();
        }

        /// <summary>
        /// Applies the specified search term to the given query object.
        /// </summary>
        /// <param name="search">The search expression to apply.</param>
        /// <param name="query">The query object to which the filter is applied.</param>
        /// <param name="request">The request that provides the operational context.</param>
        /// <returns>The filtered query.</returns>
        protected virtual IQuery<TIndexItem> Filter(string search, IQuery<TIndexItem> query, IRequest request)
        {
            return query;
        }

        /// <summary>
        /// Applies the specified quickfilters to the given query object.
        /// </summary>
        /// <param name="filters">The quickfilter identifiers to apply.</param>
        /// <param name="query">The query object to which the filter is applied.</param>
        /// <param name="request">The request that provides the operational context.</param>
        /// <returns>The filtered query.</returns>
        protected virtual IQuery<TIndexItem> Filter(IEnumerable<string> filters, IQuery<TIndexItem> query, IRequest request)
        {
            return query;
        }
    }
}
