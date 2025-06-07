using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using WebExpress.WebApp.WebAttribute;
using WebExpress.WebCore;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebIndex;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Abstract class providing CRUD operations for REST API.
    /// </summary>
    /// <typeparam name="T">Type of the index item.</typeparam>
    public abstract class RestApiCrudTable<T> : RestApiCrud<T>
        where T : IIndexItem
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

            _cachedColumns = typeof(T)
                .GetProperties()
                .Where(prop => Attribute.IsDefined(prop, typeof(RestTableColumnNameAttribute)))
                .ToDictionary(
                    prop => prop,
                    prop =>
                    {
                        var name = (RestTableColumnNameAttribute)Attribute.GetCustomAttribute(prop, typeof(RestTableColumnNameAttribute));
                        var isHidden = Attribute.IsDefined(prop, typeof(RestTableColumnHiddenAttribute));

                        return new RestApiCrudTableColumn(name.Name)
                        {
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
        public virtual IEnumerable<RestApiCrudTableRowOption> GetOptions(Request request, T row)
        {
            return [];
        }

        /// <summary>
        /// Processing of the resource that was called via the get request.
        /// </summary>
        /// <param name="request">The request.</param>
        /// <returns>An enumeration of which json serializer can be serialized.</returns>
        public override object GetData(Request request)
        {
            var page = Convert.ToInt32(request.GetParameter("page")?.Value ?? "0"); // current page number
            var pageSize = Convert.ToInt32(request.GetParameter("pageSize")?.Value ?? "50"); // number of items per page
            var wql = request.GetParameter("wql")?.Value ?? null;

            lock (Guard)
            {
                var wqlStatement = !string.IsNullOrWhiteSpace(wql)
                    ? WebEx.ComponentHub.GetComponentManager<WebIndex.IndexManager>()?.Retrieve<T>(wql)
                    : WebEx.ComponentHub.GetComponentManager<WebIndex.IndexManager>()?.Retrieve<T>("");
                var columns = _cachedColumns
                    .Where(x => x.Value.Visible)
                    .Select(x => x.Value);
                var data = GetData(wqlStatement, request);
                var count = data.Count();

                return new
                {
                    title = I18N.Translate(request, Title),
                    columns = columns,
                    rows = data.Skip(page * pageSize).Take(pageSize).Select(row => new RestApiCrudTableRow
                    {
                        Cells = _cachedColumns
                            .Where(x => x.Value.Visible)
                            .Select(x => new RestApiCrudTableCell
                            {
                                Text = x.Key.GetValue(row)?.ToString() ?? string.Empty
                            }),
                        Options = GetOptions(request, row)
                    }),
                    page = page, // current page number
                    total = count // total number of entries
                };
            }
        }
    }
}
