using WebExpress.WebApp.Test.Model;
using WebExpress.WebApp.WebRestApi;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebIndex.Queries;
using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.Test
{
    /// <summary>
    /// Provides a test implementation of a REST API quickfilter that accepts
    /// user-defined filters, so the write verbs can be exercised against an
    /// endpoint that opts into them.
    /// </summary>
    public sealed class TestRestApiQuickfilterWritable : RestApiQuickfilter<TestIndexItem>
    {
        private readonly List<RestApiQuickfilterItem> _filters = [];

        /// <summary>
        /// Gets the filters the endpoint currently holds.
        /// </summary>
        public IEnumerable<RestApiQuickfilterItem> Filters => _filters;

        /// <summary>
        /// Gets the id assigned to the filter created last.
        /// </summary>
        public string LastCreatedId { get; private set; }

        /// <summary>
        /// Retrieves the filters the endpoint holds.
        /// </summary>
        /// <param name="context">The context in which the query is executed.</param>
        /// <param name="request">The request that provides the operational context.</param>
        /// <returns>The filters.</returns>
        protected override IEnumerable<RestApiQuickfilterItem> RetrieveItems(IQueryContext context, IRequest request)
        {
            return _filters;
        }

        /// <summary>
        /// Creates a filter and assigns it an id, as a real endpoint would.
        /// </summary>
        /// <param name="context">The context in which the query is executed.</param>
        /// <param name="request">The request that provides the operational context.</param>
        /// <param name="payload">The values the client supplied.</param>
        /// <returns>The created filter.</returns>
        protected override RestApiQuickfilterItem CreateItem(IQueryContext context, IRequest request, RestApiQuickfilterPayload payload)
        {
            LastCreatedId = $"custom-{_filters.Count + 1}";

            var item = new RestApiQuickfilterItem()
            {
                Id = LastCreatedId,
                Name = payload.Name,
                Color = string.IsNullOrWhiteSpace(payload.Color) ? null : new PropertyColorButton(payload.Color),
                Criteria = payload.Criteria,
                Custom = true
            };

            _filters.Add(item);

            return item;
        }

        /// <summary>
        /// Changes a filter the endpoint holds.
        /// </summary>
        /// <param name="context">The context in which the query is executed.</param>
        /// <param name="request">The request that provides the operational context.</param>
        /// <param name="payload">The values the client supplied.</param>
        /// <returns>The updated filter, or null when it is unknown.</returns>
        protected override RestApiQuickfilterItem UpdateItem(IQueryContext context, IRequest request, RestApiQuickfilterPayload payload)
        {
            var item = _filters.FirstOrDefault(x => x.Id == payload.Id);

            if (item is null)
            {
                return null;
            }

            item.Name = payload.Name;
            item.Criteria = payload.Criteria;

            return item;
        }

        /// <summary>
        /// Removes a filter the endpoint holds.
        /// </summary>
        /// <param name="context">The context in which the query is executed.</param>
        /// <param name="request">The request that provides the operational context.</param>
        /// <param name="id">The id of the filter to remove.</param>
        /// <returns>True when the filter was removed.</returns>
        protected override bool DeleteItem(IQueryContext context, IRequest request, string id)
        {
            return _filters.RemoveAll(x => x.Id == id) > 0;
        }
    }
}
