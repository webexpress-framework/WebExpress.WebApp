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
using WebExpress.WebIndex.Queries;
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

                // sorting
                if (!string.IsNullOrWhiteSpace(orderColumn))
                {
                    var sortProp = _cachedColumns
                        .Where(x => x.Value.Id.Equals(orderColumn, StringComparison.InvariantCultureIgnoreCase))
                        .FirstOrDefault();

                    if (sortingDirection == "desc")
                    {
                        query.OrderByDesc
                        (
                            item =>
                            ConvertSortValue(sortProp.Key.GetValue(item))
                        );
                    }
                    else
                    {
                        query.OrderByAsc
                        (
                            item =>
                            ConvertSortValue(sortProp.Key.GetValue(item))
                        );
                    }
                }

                // paging 
                query.WithPaging(pageNumber * pageSize, pageSize);

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

                using var context = CreateContext();
                var rows = Retrieve(query, context, request) ?? [];

                var result = new RestApiTableResult()
                {
                    Title = I18N.Translate(request, Title),
                    Columns = columns,
                    Rows = rows
                        .Select(row =>
                        {
                            var icon = _cachedRowIconAttribute?.GetValue(row) as IIcon;

                            return new RestApiTableRow
                            {
                                Id = row.Id.ToString(),
                                Cells = _cachedColumns.Select(x =>
                                {
                                    var value = x.Key.GetValue(row);
                                    var text = ConvertToCellValue(value, x.Key);

                                    return new RestApiTableCell
                                    {
                                        Content = text
                                    };
                                }),
                                Options = GetOptions(row, request),
                                Icon = (icon is Icon)
                                    ? (icon as Icon).Class
                                    : null,
                                Image = (icon is ImageIcon)
                                    ? (icon as ImageIcon).Uri?.ToString()
                                    : null,
                                Uri = GetUri(row, request)?.ToString(),
                                RestApi = GetRestApiForInlineEdit(row, request)?.ToString(),
                                //DataWxPrimaryAction = row.
                            };
                        }),
                    Pagination = new RestApiPaginationInfo()
                    {
                        PageNumber = pageNumber,
                        PageSize = pageSize,
                        TotalCount = rows.Count()
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
        /// <param name="row">
        /// The row object for which options are being retrieved. Cannot be null.
        /// </param>
        /// <param name="request">
        /// The request object containing the criteria for retrieving options. Cannot be null.
        /// </param>
        public virtual IEnumerable<RestApiOption> GetOptions(TIndexItem row, IRequest request)
        {
            return [];
        }

        /// <summary>
        /// Gets the URI associated with the specified request and index item.
        /// </summary>
        /// <param name="row">
        /// The index item that provides context for generating the URI. Cannot be null.
        /// </param>
        /// <param name="request">
        /// The request for which to retrieve the URI. Cannot be null.
        /// </param>
        /// <returns>
        /// An object representing the URI for the given request and index item, or null if no URI is available.
        /// </returns>
        public virtual IUri GetUri(TIndexItem row, IRequest request)
        {
            return null;
        }

        /// <summary>
        /// Retrieves the REST API URI required for performing inline edits
        /// on the specified index item within the given request context.
        /// </summary>
        /// <param name="row">
        /// The index item for which the inline‑edit REST API URI should be determined.
        /// </param>
        /// <param name="request">
        /// The request that provides the operational context for resolving
        /// the appropriate REST API URI.
        /// </param>
        /// <returns>
        /// An <see cref="IUri"/> representing the REST API endpoint used for
        /// inline editing, or <c>null</c> if no suitable endpoint is available.
        /// </returns>
        public virtual IUri GetRestApiForInlineEdit(TIndexItem row, IRequest request)
        {
            return null;
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
        /// The request that provides the operational context for resolving
        /// the appropriate REST API URI.
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

        /// <summary>
        /// Converts the specified value to its string representation for sorting purposes. If 
        /// the value is a collection (excluding strings), its elements are concatenated into
        /// a single string separated by semicolons.
        /// </summary>
        /// <param name="value">
        /// The value to convert. If the value is an enumerable collection (other than a string), 
        /// each element will be converted to a string and joined with semicolons; otherwise, the 
        /// value's string representation is returned.
        /// </param>
        /// <returns>
        /// A string representation of the value suitable for sorting. Returns an empty string if 
        /// the value is null.
        /// </returns>
        private static string ConvertSortValue(object value)
        {
            if (value is IEnumerable enumerable && value is not string)
            {
                var items = enumerable
                    .Cast<object>()
                    .Select(x => x?.ToString() ?? "");

                return string.Join(";", items);
            }

            return value?.ToString() ?? "";
        }

        /// <summary>
        /// Converts the specified value to a cell-compatible object, returning a string, 
        /// an array of strings, or null as appropriate.
        /// </summary>
        /// <param name="value">
        /// The value to convert. Can be a string, an enumerable of strings or objects, or any 
        /// other object.
        /// </param>
        /// <returns>
        /// A string if the value is a string; an array of strings if the value is an enumerable; 
        /// otherwise, the string representation of the value. Returns null if the input value 
        /// is null.
        /// </returns>
        private static object ConvertToCellValue(object value, PropertyInfo prop)
        {
            if (value == null)
            {
                return null;
            }

            // check for RestConverter<T>
            var converterAttr = prop
                .GetCustomAttributes(inherit: true)
                .FirstOrDefault
                (
                    a =>
                    a.GetType().IsGenericType &&
                    a.GetType().GetGenericTypeDefinition() == typeof(RestConverterAttribute<>)
                );

            if (converterAttr != null)
            {
                var converterType = (Type)converterAttr
                    .GetType()
                    .GetProperty(nameof(RestConverterAttribute<IRestValueConverter>.ConverterType))
                    .GetValue(converterAttr);

                var converter = (IRestValueConverter)Activator.CreateInstance(converterType);

                // convert to raw representation for table cells
                return converter.ToRaw(value, prop.PropertyType);
            }

            // no converter
            if (value is string s)
            {
                return s;
            }

            if (value is IEnumerable<string> stringEnum)
            {
                return stringEnum.ToArray();
            }

            if (value is IEnumerable<object> objEnum)
            {
                return objEnum.ToArray();
            }

            // fallback
            return value.ToString();
        }
    }
}