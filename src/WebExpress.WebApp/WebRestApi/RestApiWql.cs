using WebExpress.WebCore;
using WebExpress.WebCore.WebRestApi;
using WebExpress.WebIndex;
using WebExpress.WebIndex.Wql;
using IndexManager = WebExpress.WebApp.WebIndex.IndexManager;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// The base of the REST endpoints that read the WQL of their clients. It keeps the one place
    /// that decides which parser an endpoint reads with, so every endpoint knows the functions and
    /// predicates the application registered once in the index manager, instead of each endpoint
    /// keeping a registry of its own.
    /// </summary>
    /// <typeparam name="TIndexItem">The item type of the statements.</typeparam>
    public abstract class RestApiWql<TIndexItem> : IRestApi
        where TIndexItem : IIndexItem
    {
        /// <summary>
        /// Creates the parser the WQL of a request is read with. It knows the functions and
        /// predicates registered in the index manager; an endpoint registers predicates of its
        /// own here, such as within("SD-12") over a precomputed set of ids, so the statements
        /// of its clients may use them.
        /// </summary>
        /// <returns>The parser.</returns>
        protected virtual WqlParser<TIndexItem> CreateWqlParser()
        {
            // without a running host there is no index manager, and the parser knows the
            // built-in functions only
            return WebEx.ComponentHub?.GetComponentManager<IndexManager>()?.CreateWqlParser<TIndexItem>()
                ?? new WqlParser<TIndexItem>();
        }
    }
}