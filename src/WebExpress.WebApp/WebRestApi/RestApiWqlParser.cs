using WebExpress.WebCore;
using WebExpress.WebIndex;
using WebExpress.WebIndex.Wql;
using IndexManager = WebExpress.WebApp.WebIndex.IndexManager;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Creates the parser a REST endpoint reads the WQL of its clients with, so that every
    /// endpoint knows the functions and predicates the application registered once in the index
    /// manager, instead of each endpoint keeping a registry of its own.
    /// </summary>
    internal static class RestApiWqlParser
    {
        /// <summary>
        /// Creates the parser of an item type.
        /// </summary>
        /// <typeparam name="TIndexItem">The item type of the statements.</typeparam>
        /// <returns>The parser.</returns>
        internal static WqlParser<TIndexItem> Create<TIndexItem>()
            where TIndexItem : IIndexItem
        {
            // without a running host there is no index manager, and the parser knows the
            // built-in functions only
            return WebEx.ComponentHub?.GetComponentManager<IndexManager>()?.CreateWqlParser<TIndexItem>()
                ?? new WqlParser<TIndexItem>();
        }
    }
}
