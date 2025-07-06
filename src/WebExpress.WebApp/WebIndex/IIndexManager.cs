using System.Collections.Generic;
using WebExpress.WebCore.WebComponent;
using WebExpress.WebIndex;

namespace WebExpress.WebApp.WebIndex
{
    /// <summary>
    /// This interface provide index-specific management capabilities.
    /// </summary>
    public interface IIndexManager : IComponentManager
    {
        /// <summary>
        /// Returns all documents from the index.
        /// </summary>
        /// <typeparam name="TIndexItem">The data type. This must have the IIndexItem interface.</typeparam>
        /// <returns>An enumeration of the documents</returns>
        public IEnumerable<TIndexItem> All<TIndexItem>()
            where TIndexItem : IIndexItem;
    }
}
