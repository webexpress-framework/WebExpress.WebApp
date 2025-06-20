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

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Abstract class providing CRUD operations for REST API.
    /// </summary>
    /// <typeparam name="TIndexItem">Type of the index item.</typeparam>
    public abstract class RestApiCrudTable<TIndexItem> : RestApiCrud<TIndexItem>
        where TIndexItem : IIndexItem
    {
        private readonly Dictionary<PropertyInfo, RestApiCrudTableColumn> _cachedColumns;

        /// <summary>
        /// Returns or sets the title associated with the current object.
        /// </summary>
        public string Title { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        public RestApiCrudTable()
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
                        var name = prop.Name;
                        var label = (RestTableColumnNameAttribute)Attribute.GetCustomAttribute(prop, typeof(RestTableColumnNameAttribute));
                        var isHidden = Attribute.IsDefined(prop, typeof(RestTableColumnHiddenAttribute));

                        return new RestApiCrudTableColumn()
                        {
                            Name = name,
                            Label = label?.Name ?? name,
                            Visible = !isHidden
                        };
                    }
                );
        }

        /// <summary>
        /// Retrieves a collection of options.
        /// </summary>
        /// <param name="request">The request object containing the criteria for retrieving options. Cannot be null.</param>
        /// <param name="row">The row object for which options are being retrieved. Cannot be null.</param>
        public virtual IEnumerable<RestApiCrudTableRowOption> GetOptions(Request request, TIndexItem row)
        {
            return [];
        }

        /// <summary>
        /// Processing of the resource that was called via the get request.
        /// </summary>
        /// <param name="request">The request.</param>
        /// <returns>The response containing the result of the operation.</returns>
        public override Response GetData(Request request)
        {
            var pageNumber = Convert.ToInt32(request.GetParameter("page")?.Value ?? "0"); // current page number
            var pageSize = Convert.ToInt32(request.GetParameter("pageSize")?.Value ?? "50"); // number of items per page
            var filter = request.GetParameter("search")?.Value ?? string.Empty;
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

                var columns = _cachedColumns
                   .Where(x => x.Value.Visible)
                   .Select(x => x.Value);

                var result = new RestApiTableResult()
                {
                    Title = I18N.Translate(request, Title),
                    Columns = columns,
                    Rows = data
                        .Skip(pageNumber * pageSize)
                        .Take(pageSize)
                        .Select(row => new RestApiCrudTableRow
                        {
                            Id = row.Id.ToString(),
                            Cells = _cachedColumns
                            .Where(x => x.Value.Visible)
                            .Select(x => new RestApiCrudTableCell
                            {
                                Text = x.Key.GetValue(row)?.ToString() ?? string.Empty
                            }),
                            Options = GetOptions(request, row)
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
    }
}
