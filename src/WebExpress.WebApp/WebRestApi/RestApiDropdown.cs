using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Reflection;
using WebExpress.WebApp.WebAttribute;
using WebExpress.WebCore;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebIcon;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebRestApi;
using WebExpress.WebCore.WebStatusPage;
using WebExpress.WebCore.WebUri;
using WebExpress.WebIndex;
using WebExpress.WebIndex.Wql;
using WebExpress.WebUI.WebIcon;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Abstract base class for dropdown REST APIs based on indexed items.
    /// </summary>
    /// <typeparam name="TIndexItem">Type of the index item.</typeparam>
    public abstract class RestApiDropdown<TIndexItem> : IRestApi
        where TIndexItem : IIndexItem
    {
        private readonly PropertyInfo _cachedNameAttribute;
        private readonly PropertyInfo _cachedIconAttribute;

        /// <summary>
        /// Returns or sets the title associated with the current object.
        /// </summary>
        public string Title { get; protected set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        public RestApiDropdown()
        {
            // search for an attribute of type Title and return its value if present
            Title = GetType().CustomAttributes
                .Where(x => x?.AttributeType == typeof(TitleAttribute))
                .Select(x => x.ConstructorArguments.FirstOrDefault().Value?.ToString())
                .FirstOrDefault();

            _cachedNameAttribute = typeof(TIndexItem)
                .GetProperties()
                .Where(prop => Attribute.IsDefined(prop, typeof(RestDropdownTextAttribute)))
                .FirstOrDefault();

            _cachedIconAttribute = typeof(TIndexItem)
                .GetProperties()
                .Where(prop => Attribute.IsDefined(prop, typeof(RestDropdownIconAttribute)))
                .FirstOrDefault();
        }

        /// <summary>
        /// Processes GET requests and returns a paged list of dropdown items.
        /// Supports search via 'q' or 'search', WQL via 'wql', paging via 
        /// 'p' (page) and 's' (pageSize) or 'm' (max).
        /// </summary>
        /// <param name="request">The request.</param>
        /// <returns>The response containing dropdown items and pagination.</returns>
        [Method(RequestMethod.GET)]
        public IResponse Retrieve(IRequest request)
        {
            // default page size aligned with dropdown max entries
            var defaultPageSize = 25;

            // accept both 'q' and 'search' to align with common dropdown conventions
            var filter = request.GetParameter("q")?.Value
                         ?? request.GetParameter("search")?.Value
                         ?? string.Empty;

            var wql = request.GetParameter("wql")?.Value ?? null;

            // page number parsing with safe default
            var pageRaw = request.GetParameter("p")?.Value;
            var pageNumber = 0;
            if (!string.IsNullOrWhiteSpace(pageRaw))
            {
                if (int.TryParse(pageRaw, NumberStyles.Integer, CultureInfo.InvariantCulture, out var pn))
                {
                    pageNumber = Math.Max(0, pn);
                }
            }

            // support 'pageSize' and 'max' (synonym) with a default of 25
            var pageSize = defaultPageSize;
            var pageSizeRaw = request.GetParameter("s")?.Value
                ?? request.GetParameter("m")?.Value;
            if (!string.IsNullOrWhiteSpace(pageSizeRaw))
            {
                if (int.TryParse(pageSizeRaw, NumberStyles.Integer, CultureInfo.InvariantCulture, out var ps))
                {
                    pageSize = Math.Max(1, ps);
                }
            }

            try
            {
                IEnumerable<TIndexItem> source = [];

                if (!string.IsNullOrWhiteSpace(wql))
                {
                    // evaluate wql if provided
                    var wqlStatement = WebEx.ComponentHub.GetComponentManager<WebIndex.IndexManager>()?
                        .Retrieve<TIndexItem>(wql);

                    source = GetData(wqlStatement, request) ?? [];
                }
                else
                {
                    // fallback to textual filtering
                    source = GetData(filter, request) ?? [];
                }

                // apply paging
                var total = source.Count();
                var pageItems = source
                    .Skip(pageSize * pageNumber)
                    .Take(pageSize);

                var result = new RestApiDropdownResult<IIndexItem>()
                {
                    Title = I18N.Translate(request, Title),
                    Items = pageItems.Select(x =>
                    {
                        var icon = _cachedIconAttribute?.GetValue(x) as IIcon;
                        return new RestApiDropdownItem
                        {
                            Id = x.Id,
                            Text = _cachedNameAttribute?.GetValue(x)?.ToString() ?? x.Id.ToString(),
                            Uri = GetUri(request, x)?.ToString(),
                            Icon = (icon is Icon) ? (icon as Icon).Class : null,
                            Image = (icon is ImageIcon) ? (icon as ImageIcon).Uri?.ToString() : null
                        };
                    }),
                    Pagination = new RestApiPaginationInfo()
                    {
                        PageNumber = pageNumber,
                        PageSize = pageSize,
                        TotalCount = total
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
        /// Gets the URI associated with the specified request and index item.
        /// </summary>
        /// <param name="request">
        /// The request for which to retrieve the URI. Cannot be null.
        /// </param>
        /// <param name="item">
        /// The index item that provides context for generating the URI. Cannot be null.
        /// </param>
        /// <returns>
        /// An object representing the URI for the given request and index item, or null if no URI is available.
        /// </returns>
        public virtual IUri GetUri(IRequest request, TIndexItem item)
        {
            return null;
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
