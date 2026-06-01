using WebExpress.WebApp.Test.Model;
using WebExpress.WebApp.WebRestApi;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebIndex.Queries;

namespace WebExpress.WebApp.Test
{
    /// <summary>
    /// Provides a minimal in-memory implementation of <see cref="RestApiWatcher"/>
    /// used to exercise the base class's HTTP wiring and sub-path routing.
    /// </summary>
    public sealed class TestRestApiWatcher : RestApiWatcher<TestIndexItem>
    {
        private readonly List<RestApiWatcherItem> _watchers;
        private readonly IDictionary<string, RestApiWatcherItem> _directory;

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="seed">Optional seed of pre-existing watchers.</param>
        /// <param name="directory">Optional directory of resolvable users (id → record). When omitted, the seeded watchers themselves act as the directory.</param>
        public TestRestApiWatcher(IEnumerable<RestApiWatcherItem> seed = null, IDictionary<string, RestApiWatcherItem> directory = null)
        {
            _watchers = seed?.ToList() ?? [];
            _directory = directory ?? _watchers.ToDictionary(x => x.Id, x => x);
        }

        /// <summary>
        /// Gets the watchers currently held in memory.
        /// </summary>
        public IReadOnlyList<RestApiWatcherItem> Watchers => _watchers;

        /// <summary>
        /// Returns the current set of watchers to be rendered by the
        /// client-side controller.
        /// </summary>
        /// <param name="query">
        /// An object containing the query parameters used to filter and select 
        /// index items. Cannot be null.
        /// </param>
        /// <param name="context">
        /// The context in which the query is executed. Provides additional 
        /// information or constraints for the retrieval operation. Cannot 
        /// be null.
        /// </param>
        /// <param name="request">The incoming request.</param>
        /// <returns>The watchers.</returns>
        protected override IEnumerable<RestApiWatcherItem> RetrieveWatchers(IQuery<TestIndexItem> query, IQueryContext context, IRequest request) => _watchers;

        /// <summary>
        /// Persists a newly added watcher.
        /// </summary>
        /// <param name="userId">The id of the user to be added.</param>
        /// <param name="context">
        /// The context in which the query is executed. Provides additional 
        /// information or constraints for the retrieval operation. Cannot 
        /// be null.
        /// </param>
        /// <param name="request">The incoming request.</param>
        /// <returns>
        /// The added watcher record, or <see langword="null"/> when the 
        /// user cannot be resolved.
        /// </returns>
        protected override RestApiWatcherItem AddWatcher(string userId, IQueryContext context, IRequest request)
        {
            if (!_directory.TryGetValue(userId, out var user))
            {
                return null;
            }

            if (_watchers.Any(x => x.Id == userId))
            {
                return user;
            }

            _watchers.Add(user);
            return user;
        }

        /// <summary>
        /// Removes an watcher.
        /// </summary>
        /// <param name="userId">The id of the user to be removed.</param>
        /// <param name="context">
        /// The context in which the query is executed. Provides additional 
        /// information or constraints for the retrieval operation. Cannot 
        /// be null.
        /// </param>
        /// <param name="request">The incoming request.</param>
        /// <returns>
        /// <see langword="true"/> when the watcher existed and was removed.
        /// </returns>
        protected override bool RemoveWatcher(string userId, IQueryContext context, IRequest request)
        {
            var existing = _watchers.FirstOrDefault(x => x.Id == userId);
            if (existing is null)
            {
                return false;
            }

            _watchers.Remove(existing);
            return true;
        }
    }
}
