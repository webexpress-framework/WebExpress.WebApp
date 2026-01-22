using System;
using System.Collections;
using System.Collections.Generic;
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
    /// Abstract class providing table operations for REST API.
    /// </summary>
    /// <typeparam name="TIndexItem">Type of the index item.</typeparam>
    public abstract class RestApiTable<TIndexItem> : IRestApi
        where TIndexItem : IIndexItem
    {
        private readonly Dictionary<PropertyInfo, RestApiTableColumn> _cachedColumns;
        private readonly PropertyInfo _cachedRowIconAttribute;

        /// <summary>
        /// Returns or sets the title associated with the current object.
        /// </summary>
        public string Title { get; protected set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        public RestApiTable()
        {
            // search for an attribute of type Title and return its value if present
            Title = GetType().CustomAttributes
                .Where(x => x?.AttributeType == typeof(TitleAttribute))
                .Select(x => x.ConstructorArguments.FirstOrDefault().Value?.ToString())
                .FirstOrDefault();

            _cachedColumns = typeof(TIndexItem)
                .GetProperties()
                .Where(prop => Attribute.IsDefined(prop, typeof(RestTableColumnNameAttribute)))
                .ToDictionary(
                    prop => prop,
                    prop =>
                    {
                        var id = $"{prop.DeclaringType.FullName}.{prop.Name}";
                        var name = prop.Name;
                        var labelAttr = (RestTableColumnNameAttribute)Attribute.GetCustomAttribute(prop, typeof(RestTableColumnNameAttribute));
                        var templateAttr = prop
                            .GetCustomAttributes(inherit: true)
                            .FirstOrDefault
                            (
                                a =>
                                typeof(IRestTableColumnTemplate)
                                    .IsAssignableFrom(a.GetType())
                            );

                        var isHidden = Attribute.IsDefined(prop, typeof(RestTableColumnHiddenAttribute));

                        var column = new RestApiTableColumn()
                        {
                            Id = id,
                            Name = name,
                            Label = labelAttr?.Name ?? name,
                            Visible = !isHidden,
                            Template = null
                        };

                        // configure rendering for display
                        if (templateAttr is IRestTableColumnTemplate template)
                        {
                            column.Template = template;
                        }

                        return column;
                    }
                );

            _cachedRowIconAttribute = typeof(TIndexItem)
                .GetProperties()
                .Where(prop => Attribute.IsDefined(prop, typeof(RestTableRowIconAttribute)))
                .FirstOrDefault();
        }

        /// <summary>
        /// Processing of the resource that was called via the get request.
        /// </summary>
        /// <param name="request">The request.</param>
        /// <returns>The response containing the result of the operation.</returns>
        [Method(RequestMethod.GET)]
        public IResponse Retrieve(IRequest request)
        {
            // (o)rderby column id, (d)irection, (p)age, (limit) page size, (q)uery string for filter, (wql) advanced query
            var pageNumber = Convert.ToInt32(request.GetParameter("p")?.Value ?? "0");
            var pageSize = Convert.ToInt32(request.GetParameter("l")?.Value ?? "50");
            var filter = request.GetParameter("q")?.Value ?? string.Empty;
            var wql = request.GetParameter("wql")?.Value ?? null;
            var orderColumn = request.GetParameter("o")?.Value;
            var sortingDirection = request.GetParameter("d")?.Value?.ToLowerInvariant();

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

                // sorting
                if (!string.IsNullOrWhiteSpace(orderColumn))
                {
                    var sortProp = _cachedColumns
                        .Where(x => x.Value.Id.Equals(orderColumn, StringComparison.InvariantCultureIgnoreCase))
                        .FirstOrDefault();

                    if (sortingDirection == "desc")
                    {
                        data = data.OrderByDescending(row =>
                        {
                            var value = sortProp.Key.GetValue(row);

                            if (value is IEnumerable enumerable && value is not string)
                            {
                                var items = enumerable
                                    .Cast<object>()
                                    .Select(x => x?.ToString() ?? "");

                                return string.Join(";", items);
                            }

                            return value?.ToString() ?? "";

                        });
                    }
                    else
                    {
                        data = data.OrderBy(row =>
                        {
                            var value = sortProp.Key.GetValue(row);

                            if (value is IEnumerable enumerable && value is not string)
                            {
                                var items = enumerable
                                    .Cast<object>()
                                    .Select(x => x?.ToString() ?? "");

                                return string.Join(";", items);
                            }

                            return value?.ToString() ?? "";
                        });
                    }
                }

                var columns = _cachedColumns
                   .Select(x => new RestApiTableColumn()
                   {
                       Id = x.Value.Id,
                       Name = x.Key.Name,
                       Label = I18N.Translate(request, x.Value.Label),
                       Icon = x.Value.Icon,
                       Visible = x.Value.Visible,
                       Width = x.Value.Width,
                       Template = x.Value.Template
                   });

                var result = new RestApiTableResult()
                {
                    Title = I18N.Translate(request, Title),
                    Columns = columns,
                    Rows = data
                        .Skip(pageNumber * pageSize)
                        .Take(pageSize)
                        .Select(row =>
                        {
                            var icon = _cachedRowIconAttribute?.GetValue(row) as IIcon;

                            return new RestApiTableRow
                            {
                                Id = row.Id.ToString(),
                                Cells = _cachedColumns.Select(x =>
                                {
                                    // check if property has a RestTableJoinAttribute
                                    var value = x.Key.GetValue(row);
                                    var text = string.Empty;

                                    // join logic handling
                                    if (x.Key.GetCustomAttributes(typeof(RestTableJoinAttribute), false).FirstOrDefault() is RestTableJoinAttribute joinAttr && value is IEnumerable enumerableValue && value is not string)
                                    {
                                        var enumerable = enumerableValue.Cast<object>();
                                        var separator = joinAttr.Separator.ToString();
                                        text = string.Join(separator, enumerable.Select
                                        (
                                            item => item?.ToString() ?? string.Empty)
                                        );
                                    }
                                    else
                                    {
                                        text = value?.ToString() ?? string.Empty;
                                    }

                                    return new RestApiTableCell
                                    {
                                        Text = text
                                    };
                                }),
                                Options = GetOptions(request, row),
                                Icon = (icon is Icon) ? (icon as Icon).Class : null,
                                Image = (icon is ImageIcon) ? (icon as ImageIcon).Uri?.ToString() : null,
                                Uri = GetUri(request, row)?.ToString(),
                                RestApi = GetRestApiForInlineEdit(request, row)?.ToString()
                            };
                        }),
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
        /// Handles configuration for column order or row order via POST/PUT using parameters 
        /// "c" and/or "r". Only visible column/row ids, no hidden flag; omitted columns are hidden.
        /// </summary>
        /// <param name="request">Current HTTP request.</param>
        /// <returns>Response indicating configuration status.</returns>
        [Method(RequestMethod.POST)]
        [Method(RequestMethod.PUT)]
        public IResponse Configure(IRequest request)
        {
            try
            {
                var c = request.GetParameter("c")?.Value; // column ids (comma-separated)
                var r = request.GetParameter("r")?.Value; // row ids (comma-separated)

                //if (!string.IsNullOrWhiteSpace(c))
                //{
                //    _columnOrder = c.Split(',')
                //        .Select(x => x.Trim())
                //        .Where(x => !string.IsNullOrWhiteSpace(x))
                //        .ToList();
                //}
                //if (!string.IsNullOrWhiteSpace(r))
                //{
                //    _rowOrder = r.Split(',')
                //        .Select(x => x.Trim())
                //        .Where(x => !string.IsNullOrWhiteSpace(x))
                //        .ToList();
                //}

                return new ResponseOK();
            }
            catch (Exception ex)
            {
                return new ResponseBadRequest(new StatusMessage($"Error in configuration: {ex}"));
            }
        }

        /// <summary>
        /// Retrieves a collection of options.
        /// </summary>
        /// <param name="request">The request object containing the criteria for retrieving options. Cannot be null.</param>
        /// <param name="row">The row object for which options are being retrieved. Cannot be null.</param>
        public virtual IEnumerable<RestApiOption> GetOptions(IRequest request, TIndexItem row)
        {
            return [];
        }

        /// <summary>
        /// Gets the URI associated with the specified request and index item.
        /// </summary>
        /// <param name="request">
        /// The request for which to retrieve the URI. Cannot be null.
        /// </param>
        /// <param name="row">
        /// The index item that provides context for generating the URI. Cannot be null.
        /// </param>
        /// <returns>
        /// An object representing the URI for the given request and index item, or null if no URI is available.
        /// </returns>
        public virtual IUri GetUri(IRequest request, TIndexItem row)
        {
            return null;
        }

        /// <summary>
        /// Retrieves the REST API URI required for performing inline edits
        /// on the specified index item within the given request context.
        /// </summary>
        /// <param name="request">
        /// The request that provides the operational context for resolving
        /// the appropriate REST API URI.
        /// </param>
        /// <param name="row">
        /// The index item for which the inline‑edit REST API URI should be determined.
        /// </param>
        /// <returns>
        /// An <see cref="IUri"/> representing the REST API endpoint used for
        /// inline editing, or <c>null</c> if no suitable endpoint is available.
        /// </returns>
        public virtual IUri GetRestApiForInlineEdit(IRequest request, TIndexItem row)
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