using WebExpress.WebApp.Test.Model;
using WebExpress.WebApp.WebRestApi;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebIndex.Queries;

namespace WebExpress.WebApp.Test
{
    /// <summary>
    /// Provides a minimal in-memory implementation of <see cref="RestApiObserver"/>
    /// used to exercise the base class's HTTP wiring and sub-path routing.
    /// </summary>
    public sealed class TestRestApiObserver : RestApiObserver<TestIndexItem>
    {
        private readonly List<RestApiObserverItem> _observers;
        private readonly IDictionary<string, RestApiObserverItem> _directory;

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="seed">Optional seed of pre-existing observers.</param>
        /// <param name="directory">Optional directory of resolvable users (id → record). When omitted, the seeded observers themselves act as the directory.</param>
        public TestRestApiObserver(IEnumerable<RestApiObserverItem> seed = null, IDictionary<string, RestApiObserverItem> directory = null)
        {
            _observers = seed?.ToList() ?? [];
            _directory = directory ?? _observers.ToDictionary(x => x.Id, x => x);
        }

        /// <summary>
        /// Gets the observers currently held in memory.
        /// </summary>
        public IReadOnlyList<RestApiObserverItem> Observers => _observers;

        /// <summary>
        /// Returns the current set of observers to be rendered by the
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
        /// <returns>The observers.</returns>
        protected override IEnumerable<RestApiObserverItem> RetrieveObservers(IQuery<TestIndexItem> query, IQueryContext context, IRequest request) => _observers;

        /// <summary>
        /// Persists a newly added observer.
        /// </summary>
        /// <param name="userId">The id of the user to be added.</param>
        /// <param name="context">
        /// The context in which the query is executed. Provides additional 
        /// information or constraints for the retrieval operation. Cannot 
        /// be null.
        /// </param>
        /// <param name="request">The incoming request.</param>
        /// <returns>
        /// The added observer record, or <see langword="null"/> when the 
        /// user cannot be resolved.
        /// </returns>
        protected override RestApiObserverItem AddObserver(string userId, IQueryContext context, IRequest request)
        {
            if (!_directory.TryGetValue(userId, out var user))
            {
                return null;
            }

            if (_observers.Any(x => x.Id == userId))
            {
                return user;
            }

            _observers.Add(user);
            return user;
        }

        /// <summary>
        /// Removes an observer.
        /// </summary>
        /// <param name="userId">The id of the user to be removed.</param>
        /// <param name="context">
        /// The context in which the query is executed. Provides additional 
        /// information or constraints for the retrieval operation. Cannot 
        /// be null.
        /// </param>
        /// <param name="request">The incoming request.</param>
        /// <returns>
        /// <see langword="true"/> when the observer existed and was removed.
        /// </returns>
        protected override bool RemoveObserver(string userId, IQueryContext context, IRequest request)
        {
            var existing = _observers.FirstOrDefault(x => x.Id == userId);
            if (existing is null)
            {
                return false;
            }

            _observers.Remove(existing);
            return true;
        }
    }
}
