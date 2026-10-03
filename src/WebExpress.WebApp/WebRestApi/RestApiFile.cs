using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebRestApi;
using WebExpress.WebIndex;
using WebExpress.WebIndex.Queries;
using WebExpress.WebIndex.Wql;
using WebExpress.WebUI.Internationalization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Abstract class providing file responses for REST API, which is the server
    /// side of the file view control.
    /// </summary>
    /// <typeparam name="TIndexItem">Type of the index item.</typeparam>
    public abstract class RestApiFile<TIndexItem> : IRestApi
        where TIndexItem : IIndexItem
    {
        private static readonly JsonSerializerOptions _payloadJsonOptions = new()
        {
            PropertyNameCaseInsensitive = true
        };

        /// <summary>
        /// Gets or sets the title associated with the current object.
        /// </summary>
        public string Title { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        protected RestApiFile()
        {
            // read attributes once
            Title = GetType().CustomAttributes
                .Where(x => x is not null && x.AttributeType == typeof(TitleAttribute))
                .Select(x => x.ConstructorArguments.FirstOrDefault().Value?.ToString())
                .FirstOrDefault();
        }

        /// <summary>
        /// Processing of the resource that was called via the get request.
        /// Returns the files, the title and the pagination.
        /// </summary>
        /// <param name="request">The request.</param>
        /// <returns>The response containing the result of the operation.</returns>
        [Method(RequestMethod.GET)]
        public IResponse Retrieve(IRequest request)
        {
            var pageNumber = request.ParseIntParameter("p", 0);
            var pageSize = request.ParseIntParameter("l", 50);
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

                // quickfilters
                query = Filter(filters, query, request);

                // paging
                query = query.WithPaging(pageNumber * pageSize, pageSize);

                using var context = CreateContext();
                var items = RetrieveItems(query, context, request).ToList();

                var result = new RestApiFileResult<TIndexItem>()
                {
                    Title = I18N.Translate(request, Title),
                    Items = items,
                    Total = RetrieveTotal(query, request),
                    Pagination = new RestApiPaginationInfo()
                    {
                        PageNumber = pageNumber,
                        PageSize = pageSize,
                        TotalCount = items.Count
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
        /// Handles a description that was edited in place in the file view. The
        /// payload names the file and carries the new text; the endpoint stays a
        /// single address rather than one per file, mirroring the way the table
        /// takes its configuration.
        /// </summary>
        /// <param name="request">The request.</param>
        /// <returns>The response indicating whether the change was accepted.</returns>
        [Method(RequestMethod.POST)]
        [Method(RequestMethod.PUT)]
        public IResponse Update(IRequest request)
        {
            try
            {
                var payload = ReadDescriptionPayload(request);

                if (payload is null || string.IsNullOrWhiteSpace(payload.Id))
                {
                    return RestApiFault.BadRequest(request, null, "No file was named.");
                }

                UpdateDescription(payload.Id, payload.Description ?? string.Empty, request);

                return new ResponseOK();
            }
            catch (Exception ex)
            {
                return RestApiFault.BadRequest(request, ex, "Error processing request.");
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
        /// Retrieves the files that match the specified query criteria.
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
        /// An enumerable collection of files that satisfy the query criteria. The
        /// collection may be empty if no items match.
        /// </returns>
        protected abstract IEnumerable<RestApiFileItem> RetrieveItems(IQuery<TIndexItem> query, IQueryContext context, IRequest request);

        /// <summary>
        /// Returns how many files the query matched in total, across every page.
        /// The default implementation says nothing, so the client infers a count
        /// from the page it received; an endpoint that can count cheaply
        /// overrides this and gives the real number.
        /// </summary>
        /// <param name="query">The query the page was taken from.</param>
        /// <param name="request">The triggering request.</param>
        /// <returns>The total, or null when the endpoint cannot say.</returns>
        protected virtual int? RetrieveTotal(IQuery<TIndexItem> query, IRequest request)
        {
            return null;
        }

        /// <summary>
        /// Persists a description that was edited in place. The default
        /// implementation is a no-op, so an endpoint that offers a read-only file
        /// view does not have to implement it; a derived class overrides it to
        /// write the description to the underlying store.
        /// </summary>
        /// <param name="id">The id of the file whose description changed.</param>
        /// <param name="description">The new description.</param>
        /// <param name="request">The triggering request.</param>
        protected virtual void UpdateDescription(string id, string description, IRequest request)
        {
        }

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

        /// <summary>
        /// Formats a byte count the way the file list control formats it, so a
        /// file that arrives through the API reads exactly like one the server
        /// rendered into the page.
        /// </summary>
        /// <param name="size">The size in bytes. A negative value has no size.</param>
        /// <param name="request">The request, which carries the culture.</param>
        /// <returns>The formatted size, or null when there is none.</returns>
        protected static string FormatSize(long size, IRequest request)
        {
            if (size < 0)
            {
                return null;
            }

            return string.Format(new FileSizeFormatProvider()
            {
                Culture = request?.Culture
            }, "{0:fs}", size);
        }

        /// <summary>
        /// Formats a date the way the file list control formats it.
        /// </summary>
        /// <param name="date">The date. The minimum value has no date.</param>
        /// <param name="request">The request, which carries the culture.</param>
        /// <returns>The formatted date, or null when there is none.</returns>
        protected static string FormatDate(DateTime date, IRequest request)
        {
            if (date == DateTime.MinValue)
            {
                return null;
            }

            return date.ToString("d", request?.Culture);
        }

        /// <summary>
        /// Extracts the description payload from the request, supporting both an
        /// application/json body and the url-encoded id and description
        /// parameters as a fallback.
        /// </summary>
        /// <param name="request">The triggering request.</param>
        /// <returns>The payload, or null when the request carried none.</returns>
        private static RestApiFileDescriptionPayload ReadDescriptionPayload(IRequest request)
        {
            if (request is Request raw &&
                raw.Content is { Length: > 0 } content &&
                raw.Header?.ContentType?.Contains("application/json", StringComparison.OrdinalIgnoreCase) == true)
            {
                try
                {
                    var fromBody = JsonSerializer.Deserialize<RestApiFileDescriptionPayload>(content, _payloadJsonOptions);

                    if (fromBody is not null && !string.IsNullOrWhiteSpace(fromBody.Id))
                    {
                        return fromBody;
                    }
                }
                catch (JsonException)
                {
                    // fall through to parameter parsing
                }
            }

            var id = request.GetParameter("id")?.Value;

            if (string.IsNullOrWhiteSpace(id))
            {
                return null;
            }

            return new RestApiFileDescriptionPayload
            {
                Id = id,
                Description = request.GetParameter("description")?.Value ?? string.Empty
            };
        }
    }
}
