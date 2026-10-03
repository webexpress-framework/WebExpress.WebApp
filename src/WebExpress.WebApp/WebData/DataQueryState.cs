namespace WebExpress.WebApp.WebData
{
    /// <summary>
    /// The standard query state of a ViewState that backs a list, table or tile: the
    /// search term, the structured query, the filter, the page index, the page
    /// size and the order. It is used as the TState of a
    /// ControlViewState&lt;TState&gt; so the initial state is configured through
    /// typed properties rather than string keys. Each non null property is
    /// emitted as a wx-prop whose name is the camel cased property name, so the
    /// JavaScript ViewState seeds page, pageSize, search and the rest.
    /// </summary>
    public class DataQueryState
    {
        /// <summary>
        /// Gets or sets the initial page index.
        /// </summary>
        public int Page { get; set; }

        /// <summary>
        /// Gets or sets the page size.
        /// </summary>
        public int PageSize { get; set; } = 50;

        /// <summary>
        /// Gets or sets the initial search pattern.
        /// </summary>
        public string Search { get; set; }

        /// <summary>
        /// Gets or sets the initial structured query.
        /// </summary>
        public string Wql { get; set; }

        /// <summary>
        /// Gets or sets the initial filter.
        /// </summary>
        public string Filter { get; set; }

        /// <summary>
        /// Gets or sets the initial order field.
        /// </summary>
        public string OrderBy { get; set; }

        /// <summary>
        /// Gets or sets the initial order direction.
        /// </summary>
        public string OrderDir { get; set; }
    }

    /// <summary>
    /// The empty state of a ViewState that seeds no initial state, used as the TState
    /// of a ControlViewState&lt;TState&gt; for a board, a dashboard, a tab set or
    /// a comment surface that loads everything from its resource.
    /// </summary>
    public sealed class EmptyState
    {
    }
}
