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
        /// <param name="request">The request object containing the criteria for retrieving options. Cannot be null.</param>
        /// <param name="row">The row object for which options are being retrieved. Cannot be null.</param>
        public virtual IEnumerable<RestApiOption> GetOptions(IRequest request, TIndexItem row)
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
            var pageSize = Convert.ToInt32(request.GetParameter("s")?.Value ?? "50");
            var filter = request.GetParameter("q")?.Value ?? string.Empty;
            var wql = request.GetParameter("wql")?.Value ?? null;

            try
            {
                IEnumerable<TIndexItem> data = [];

                if (!string.IsNullOrWhiteSpace(wql))
                {
                    var wqlStatement = WebEx.ComponentHub.GetComponentManager<WebIndex.IndexManager>()?
                        .Retrieve<TIndexItem>(wql);

                    data = GetData(wqlStatement, request);
                }
                else
                {
                    data = GetData(filter, request);
                }

                // page slice
                var pageSlice = data
                    .Skip(pageNumber * pageSize)
                    .Take(pageSize)
                    .ToArray();

                // map to list items
                var items = pageSlice.Select(row =>
                {
                    var item = new RestApiListItem<TIndexItem>()
                    {
                        Id = row.Id.ToString(),
                        Text = ResolveItemText(row),
                        Item = row,
                        // icon/image could be derived by convention or additional attributes if available
                        Icon = null,
                        Image = null,
                        Options = GetOptions(request, row)
                    };
                    return item;
                });

                var result = new RestApiListResult<TIndexItem>()
                {
                    Title = I18N.Translate(request, Title),
                    Items = items,
                    Pagination = new RestApiPaginationInfo()
                    {
                        PageNumber = pageNumber,
                        PageSize = pageSize,
                        TotalCount = data.Count()
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
        /// Retrieves a collection of index items that match the specified filter 
        /// and request parameters.
        /// </summary>
        /// <param name="filter">
        /// A string used to filter the results. The format and supported values 
        /// depend on the implementation. Can be null or empty to indicate no filtering.
        /// </param>
        /// <param name="request">
        /// An object containing additional parameters that influence the data 
        /// retrieval operation. Cannot be null.
        /// </param>
        /// <returns>
        /// An enumerable collection of index items of type TIndexItem that 
        /// satisfy the filter and request criteria. The collection may be 
        /// empty if no items match.
        /// </returns>
        public virtual IEnumerable<TIndexItem> GetData(string filter, IRequest request)
        {
            return [];
        }

        /// <summary>
        /// Retrieves a collection of index items that match the specified WQL 
        /// statement and request parameters.
        /// </summary>
        /// <param name="wqlStatement">
        /// The WQL statement that defines the query criteria for selecting index 
        /// items. Cannot be null.
        /// </param>
        /// <param name="request">
        /// The request object containing additional parameters or options that 
        /// influence the data retrieval. Cannot be null.
        /// </param>
        /// <returns>
        /// An enumerable collection of index items that satisfy the query 
        /// criteria. The collection is empty if no items match.
        /// </returns>
        public virtual IEnumerable<TIndexItem> GetData(IWqlStatement wqlStatement, IRequest request)
        {
            return [];
        }
    }
}