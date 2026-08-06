using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
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
    /// Abstract class providing table operations for REST API.
    /// </summary>
    /// <typeparam name="TIndexItem">Type of the index item.</typeparam>
    public abstract class RestApiTable<TIndexItem> : IRestApi
        where TIndexItem : IIndexItem
    {
        private static readonly JsonSerializerOptions _configurePayloadJsonOptions = new()
        {
            PropertyNameCaseInsensitive = true
        };

        /// <summary>
        /// Gets or sets the title associated with the current object.
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
            var pageNumber = request.ParseIntParameter("p", 0);
            var pageSize = request.ParseIntParameter("l", 50);
            var search = request.GetParameter("q")?.Value ?? string.Empty;
            var wql = request.GetParameter("wql")?.Value ?? null;
            var filters = request.GetParameter("f")?.Value?.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries) ?? [];
            var orderColumn = request.GetParameter("o")?.Value;
            var sortingDirection = request.GetParameter("d")?.Value?.ToLowerInvariant();
            var query = new Query<TIndexItem>() as IQuery<TIndexItem>;

            try
            {
                var columns = RetrieveColums(request);

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

                // sorting
                if (!string.IsNullOrWhiteSpace(orderColumn))
                {
                    var sortProp = columns
                        .FirstOrDefault(x => x.Id.Equals(orderColumn, StringComparison.InvariantCultureIgnoreCase));

                    if (sortingDirection == "desc")
                    {
                        query = query.OrderByDesc
                        (
                            item =>
                            sortProp.Name
                        );
                    }
                    else
                    {
                        query = query.OrderByAsc
                        (
                            item =>
                            sortProp.Name
                        );
                    }
                }

                // paging 
                query = query.WithPaging(pageNumber * pageSize, pageSize);

                using var context = CreateContext();
                var rows = RetrieveRows(query, context, columns, request) ?? [];

                var result = new RestApiTableResult()
                {
                    Title = I18N.Translate(request, Title),
                    Columns = columns,
                    Rows = rows,
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
                return RestApiFault.BadRequest(request, ex, "Error processing request.");
            }
        }

        /// <summary>
        /// Handles configuration of column layout (order, width, visibility) and
        /// row order via POST/PUT. Accepts either a JSON body of the form
        /// <c>{ "c": [{"id":"col1","visible":true,"width":120}, ...], "r": ["row1", ...] }</c>
        /// or the legacy URL-encoded parameters <c>c</c>/<c>v</c>/<c>w</c>/<c>r</c>
        /// where each value is comma-separated and indexed by position.
        /// Columns omitted from the payload are appended at the tail and marked as hidden.
        /// </summary>
        /// <param name="request">Current HTTP request.</param>
        /// <returns>Response indicating configuration status.</returns>
        [Method(RequestMethod.POST)]
        [Method(RequestMethod.PUT)]
        public IResponse Configure(IRequest request)
        {
            try
            {
                var payload = ReadConfigurePayload(request);

                if (payload?.Columns is { Count: > 0 })
                {
                    var available = (RetrieveColums(request) ?? []).ToList();
                    var lookup = available.ToDictionary(c => c.Id, StringComparer.OrdinalIgnoreCase);

                    var resolved = new List<RestApiTableColumn>(available.Count);
                    var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

                    foreach (var update in payload.Columns)
                    {
                        if (string.IsNullOrWhiteSpace(update?.Id) ||
                            !lookup.TryGetValue(update.Id, out var template) ||
                            !seen.Add(template.Id))
                        {
                            continue;
                        }

                        resolved.Add(new RestApiTableColumn
                        {
                            Id = template.Id,
                            Name = template.Name,
                            Label = template.Label,
                            Icon = template.Icon,
                            Template = template.Template,
                            Visible = update.Visible ?? template.Visible,
                            Width = update.Width
                        });
                    }

                    // append columns the client did not include at the tail and mark them as hidden
                    foreach (var column in available)
                    {
                        if (seen.Contains(column.Id))
                        {
                            continue;
                        }

                        resolved.Add(new RestApiTableColumn
                        {
                            Id = column.Id,
                            Name = column.Name,
                            Label = column.Label,
                            Icon = column.Icon,
                            Template = column.Template,
                            Visible = false,
                            Width = column.Width
                        });
                    }

                    UpdateColumns(resolved, request);
                }

                if (payload?.Rows is { Count: > 0 })
                {
                    UpdateRows(payload.Rows, request);
                }

                return new ResponseOK();
            }
            catch (Exception ex)
            {
                return RestApiFault.BadRequest(request, ex, "Error in configuration.");
            }
        }

        /// <summary>
        /// Persists the user-defined column layout produced by
        /// <see cref="Configure"/>. The default implementation is a no-op;
        /// derived classes should override it to write the layout to the
        /// underlying store (session, user profile, database, ...).
        /// </summary>
        /// <param name="columns">
        /// The full list of columns in the order chosen by the user. Each entry
        /// carries the user-defined <see cref="RestApiTableColumn.Visible"/> and
        /// <see cref="RestApiTableColumn.Width"/> values. Columns the client did
        /// not include are appended at the tail with <c>Visible = false</c>.
        /// </param>
        /// <param name="request">The triggering request.</param>
        protected virtual void UpdateColumns(IEnumerable<RestApiTableColumn> columns, IRequest request)
        {
        }

        /// <summary>
        /// Persists the user-defined row order produced by <see cref="Configure"/>.
        /// The default implementation is a no-op; derived classes should override
        /// it when row reordering needs to be remembered.
        /// </summary>
        /// <param name="rowIds">The row identifiers in the order chosen by the user.</param>
        /// <param name="request">The triggering request.</param>
        protected virtual void UpdateRows(IEnumerable<string> rowIds, IRequest request)
        {
        }

        /// <summary>
        /// Extracts the column / row configuration payload from the request,
        /// supporting both an <c>application/json</c> body and the URL-encoded
        /// <c>c</c>/<c>v</c>/<c>w</c>/<c>r</c> parameters as a fallback.
        /// </summary>
        /// <param name="request">The triggering request.</param>
        /// <returns>
        /// The deserialized payload, or <see langword="null"/> if the request
        /// carried no recognizable configuration.
        /// </returns>
        private static RestApiTableConfigurePayload ReadConfigurePayload(IRequest request)
        {
            if (request is Request raw &&
                raw.Content is { Length: > 0 } content &&
                raw.Header?.ContentType?.Contains("application/json", StringComparison.OrdinalIgnoreCase) == true)
            {
                try
                {
                    var fromBody = JsonSerializer.Deserialize<RestApiTableConfigurePayload>(content, _configurePayloadJsonOptions);
                    if (fromBody is not null && ((fromBody.Columns?.Count ?? 0) > 0 || (fromBody.Rows?.Count ?? 0) > 0))
                    {
                        return fromBody;
                    }
                }
                catch (JsonException)
                {
                    // fall through to parameter parsing
                }
            }

            var ids = request.GetParameter("c")?.Value?
                .Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries) ?? [];
            var visibles = request.GetParameter("v")?.Value?
                .Split(',', StringSplitOptions.TrimEntries) ?? [];
            var widths = request.GetParameter("w")?.Value?
                .Split(',', StringSplitOptions.TrimEntries) ?? [];
            var rows = request.GetParameter("r")?.Value?
                .Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);

            if (ids.Length == 0 && (rows is null || rows.Length == 0))
            {
                return null;
            }

            var columns = new List<RestApiTableColumnUpdate>(ids.Length);
            for (var i = 0; i < ids.Length; i++)
            {
                bool? visible = null;
                if (i < visibles.Length && !string.IsNullOrWhiteSpace(visibles[i]))
                {
                    visible = visibles[i] == "1" ||
                        visibles[i].Equals("true", StringComparison.OrdinalIgnoreCase);
                }

                uint? width = null;
                if (i < widths.Length && uint.TryParse(widths[i], out var parsed))
                {
                    width = parsed;
                }

                columns.Add(new RestApiTableColumnUpdate
                {
                    Id = ids[i],
                    Visible = visible,
                    Width = width
                });
            }

            return new RestApiTableConfigurePayload
            {
                Columns = columns,
                Rows = rows
            };
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
        /// Retrieves the collection of columns available for the specified 
        /// REST API request.
        /// </summary>
        /// <param name="request">
        /// The request for which to retrieve the available table columns.
        /// </param>
        /// <returns>
        /// An enumerable collection of columns describing the structure of 
        /// the data returned by the REST API for the specified request.
        /// </returns>
        protected abstract IEnumerable<RestApiTableColumn> RetrieveColums(IRequest request);

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
        /// <param name="columns">
        /// The collection of columns available for the specified REST API request.
        /// </param>
        /// <param name="request">
        /// The request that provides the operational context for resolving
        /// the appropriate REST API URI.
        /// </param>
        /// <returns>
        /// An enumerable collection of table rows that satisfy the query and 
        /// context. The collection may be empty if no rows match the criteria.
        /// </returns>
        protected abstract IEnumerable<RestApiTableRow> RetrieveRows(IQuery<TIndexItem> query, IQueryContext context, IEnumerable<RestApiTableColumn> columns, IRequest request);

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