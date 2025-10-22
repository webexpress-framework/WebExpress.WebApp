using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using WebExpress.WebCore;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebRestApi;
using WebExpress.WebCore.WebStatusPage;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Abstract base class for selection REST APIs based on indexed items.
    /// </summary>
    /// <typeparam name="TIndexItem">Type of the index item.</typeparam>
    public abstract class RestApiCrudSelection<TIndexItem> : RestApiCrud<TIndexItem>
        where TIndexItem : IRestApiCrudSelectionItem
    {
        /// <summary>
        /// Processes GET requests and returns a paged list of dropdown items.
        /// Supports search via 'q' or 'search', WQL via 'wql', paging via 'page' and 'pageSize' or 'max'.
        /// </summary>
        /// <param name="request">The request.</param>
        /// <returns>The response containing dropdown items and pagination.</returns>
        public override Response GetData(Request request)
        {
            // default page size aligned with dropdown max entries
            var defaultPageSize = 25;

            // accept both 'q' and 'search' to align with common dropdown conventions
            var filter = request.GetParameter("q")?.Value
                         ?? request.GetParameter("search")?.Value
                         ?? string.Empty;

            var wql = request.GetParameter("wql")?.Value ?? null;

            // page number parsing with safe default
            var pageRaw = request.GetParameter("page")?.Value;
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
            var pageSizeRaw = request.GetParameter("pageSize")?.Value ?? request.GetParameter("max")?.Value;
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

                var result = new RestApiCrudResult<IRestApiCrudSelectionItem>()
                {
                    Data = pageItems.Select(x => x as IRestApiCrudSelectionItem),
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
    }
}
