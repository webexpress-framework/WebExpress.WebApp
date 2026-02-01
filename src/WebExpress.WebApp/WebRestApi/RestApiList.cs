using System;
using System.Collections.Generic;
using System.Globalization;
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
    /// Abstract class providing CRUD list responses for REST API.
    /// Produces a flat "items" array suitable for the ListCtrl frontend.
    /// </summary>
    /// <typeparam name="TIndexItem">Type of the index item.</typeparam>
    public abstract class RestApiList<TIndexItem> : IRestApi
        where TIndexItem : IIndexItem
    {
        /// <summary>
        /// Returns or sets the title associated with the current object.
        /// </summary>
        public string Title { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        protected RestApiList()
        {
            // read title attribute once
            Title = GetType().CustomAttributes
                .Where(x => x is not null && x.AttributeType == typeof(TitleAttribute))
                .Select(x => x.ConstructorArguments.FirstOrDefault().Value?.ToString())
                .FirstOrDefault();
        }

        /// <summary>
        /// Retrieves a collection of options for a list item (e.g. edit/delete).
        /// </summary>
        /// <param name="row">
        /// The row object for which options are being retrieved. Cannot be null.
        /// </param>
        /// <param name="request">
        /// The request object containing the criteria for retrieving options. Cannot be null.
        /// </param>
        public virtual IEnumerable<RestApiOption> GetOptions(TIndexItem row, IRequest request)
        {
            // return empty by default
            return [];
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
            var filter = request.GetParameter("q")?.Value ?? string.Empty;
            var wql = request.GetParameter("wql")?.Value ?? null;
            var query = new Query<TIndexItem>() as IQuery<TIndexItem>;

            try
            {
                if (!string.IsNullOrWhiteSpace(wql))
                {
                    var wqlStatement = WebEx.ComponentHub.GetComponentManager<WebIndex.IndexManager>()?
                        .Retrieve<TIndexItem>(wql);

                    query = Filter(wqlStatement, query, request);
                }
                else
                {
                    query = Filter(filter, query, request);
                }

                // paging 
                query = query.WithPaging(pageNumber * pageSize, pageSize);

                var items = Retrieve(query)
                    .Select(row => new RestApiListItem<TIndexItem>()
                    {
                        Id = row.Id.ToString(),
                        Text = ResolveItemText(row),
                        Item = row,
                        Icon = null,
                        Image = null,
                        Options = GetOptions(row, request)
                    });

                var result = new RestApiListResult<TIndexItem>()
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
        /// Resolves the primary display text for the given item by locating the property
        /// annotated with RestListPrimaryTextAttribute (or the alias name "RestListPrimaryAttribute")
        /// and returning its string representation. Falls back to row.ToString() when no attribute is present.
        /// </summary>
        /// <param name="row">The item to resolve.</param>
        /// <returns>The resolved display text.</returns>
        protected virtual string ResolveItemText(TIndexItem row)
        {
            if (row is null)
            {
                return string.Empty;
            }

            var instanceType = row.GetType();
            var primaryAttrType = typeof(RestListPrimaryAttribute);

            // try to find a property explicitly marked with RestListPrimaryTextAttribute
            var prop = instanceType
                .GetProperties(BindingFlags.Public | BindingFlags.Instance)
                .FirstOrDefault(p => Attribute.IsDefined(p, primaryAttrType)) ?? instanceType
                    .GetProperties(BindingFlags.Public | BindingFlags.Instance)
                    .FirstOrDefault(p => p.GetCustomAttributes(inherit: true)
                        .Any(a => string.Equals(a.GetType().Name, "RestListPrimaryAttribute", StringComparison.Ordinal)));

            if (prop is not null)
            {
                try
                {
                    var value = prop.GetValue(row);
                    if (value is null)
                    {
                        return string.Empty;
                    }

                    if (value is IFormattable formattable)
                    {
                        // format using current culture to respect localization
                        return formattable.ToString(null, CultureInfo.CurrentCulture);
                    }

                    return value.ToString() ?? string.Empty;
                }
                catch
                {
                    // be defensive: if reflection or getter throws, fall back to safe default
                    return string.Empty;
                }
            }

            // ultimate fallback when no primary attribute is present
            return row.ToString() ?? string.Empty;
        }

        /// <summary>
        /// Retrieves a queryable collection of index items that match the specified query criteria.
        /// </summary>
        /// <param name="query">
        /// An object containing the query parameters used to filter and select index items. Cannot 
        /// be null.
        /// </param>
        /// <returns>
        /// A collection representing the filtered set of index items. 
        /// The collection may be empty if no items match the query.
        /// </returns>
        protected abstract IEnumerable<TIndexItem> Retrieve(IQuery<TIndexItem> query);

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
        /// A new query representing the result of applying the WQL filter to the input 
        /// query. The returned query may be further composed or executed to retrieve 
        /// filtered results.
        /// </returns>
        public virtual IQuery<TIndexItem> Filter(IWqlStatement wqlStatement, IQuery<TIndexItem> query, IRequest request)
        {
            return query;
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
        /// <returns>
        /// A new query representing the result of applying the WQL filter to the input 
        /// query. The returned query may be further composed or executed to retrieve 
        /// filtered results.
        /// </returns>
        public virtual IQuery<TIndexItem> Filter(string filter, IQuery<TIndexItem> query, IRequest request)
        {
            return query;
        }
    }
}