using WebExpress.WebApp.Test.Model;
using WebExpress.WebApp.WebRestApi;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebIndex.Queries;
using WebExpress.WebIndex.Wql;
using WebExpress.WebIndex.Wql.Predicate;

namespace WebExpress.WebApp.Test.WebRestApi
{
    /// <summary>
    /// Tests that the kanban and the quickfilter endpoints build their WQL queries in the query
    /// mode the endpoint chooses, as the other REST bases do.
    /// </summary>
    public class UnitTestRestApiQueryMode
    {
        /// <summary>
        /// Tests the WQL filter of a board: the text matcher of the index by default, only ToLower
        /// and Contains when the endpoint is translatable.
        /// </summary>
        /// <param name="mode">The query mode, or null for the default.</param>
        /// <param name="matcher">Whether the text matcher of the index is expected.</param>
        [Theory]
        [InlineData(null, true)]
        [InlineData(WqlQueryMode.Exact, true)]
        [InlineData(WqlQueryMode.Translatable, false)]
        public void Kanban(WqlQueryMode? mode, bool matcher)
        {
            // arrange
            var kanban = new ModeKanban(mode);

            // act
            var query = kanban.Apply("Description ~ 'alpha'");

            // validation
            var tree = string.Join(" ", query.Filters.Select(x => x.ToString()));
            Assert.Equal(matcher, tree.Contains(nameof(WqlTextMatcher)));
            Assert.Equal(!matcher, tree.Contains(".ToLower().Contains(\"alpha\")"));
        }

        /// <summary>
        /// Tests that a board without a filter, or with one that does not parse, keeps its query.
        /// </summary>
        /// <param name="wql">The filter of the board.</param>
        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("Description ~")]
        public void KanbanWithoutFilter(string wql)
        {
            // arrange
            var kanban = new ModeKanban(WqlQueryMode.Translatable);

            // act
            var query = kanban.Apply(wql);

            // validation
            Assert.Empty(query.Filters);
        }

        /// <summary>
        /// Tests the criteria of a quickfilter in both modes.
        /// </summary>
        /// <param name="mode">The query mode, or null for the default.</param>
        /// <param name="matcher">Whether the text matcher of the index is expected.</param>
        [Theory]
        [InlineData(null, true)]
        [InlineData(WqlQueryMode.Translatable, false)]
        public void Quickfilter(WqlQueryMode? mode, bool matcher)
        {
            // arrange
            var quickfilter = new ModeQuickfilter(mode);

            // act
            var query = quickfilter.Criteria("Description ~ 'alpha'");

            // validation
            var tree = string.Join(" ", query.Filters.Select(x => x.ToString()));
            Assert.Equal(matcher, tree.Contains(nameof(WqlTextMatcher)));
            Assert.Equal(!matcher, tree.Contains(".ToLower().Contains(\"alpha\")"));
            Assert.Null(quickfilter.Criteria(" "));
        }

        /// <summary>
        /// Tests that a board reads its filter with the parser the endpoint creates, so a predicate
        /// the endpoint registers is known to the statement.
        /// </summary>
        [Fact]
        public void KanbanUsesTheEndpointParser()
        {
            // arrange
            var items = new[]
            {
                new TestIndexItem { Id = Guid.NewGuid(), Key = "a" },
                new TestIndexItem { Id = Guid.NewGuid(), Key = "b" }
            };
            var kanban = new ModeKanban(null) { Within = [items[1].Id] };

            // act
            var query = kanban.Apply("within('team')");

            // validation
            Assert.Equal([items[1].Id], query.Apply(items.AsQueryable()).Select(x => x.Id));
        }

        /// <summary>
        /// A board that keeps the default query mode or chooses one.
        /// </summary>
        /// <param name="mode">The query mode, or null for the default.</param>
        private sealed class ModeKanban(WqlQueryMode? mode) : RestApiKanban<TestIndexItem>
        {
            /// <summary>
            /// Returns the chosen mode, or the default of the base class.
            /// </summary>
            protected override WqlQueryMode QueryMode => mode ?? base.QueryMode;

            /// <summary>
            /// Gets or sets the ids the within predicate stands for; null registers no predicate.
            /// </summary>
            public Guid[] Within { get; set; }

            /// <summary>
            /// Creates the parser with the within predicate when ids are given.
            /// </summary>
            /// <returns>The parser.</returns>
            protected override WqlParser<TestIndexItem> CreateWqlParser()
            {
                var parser = base.CreateWqlParser();
                if (Within is not null)
                {
                    var ids = Within.ToList();
                    parser.RegisterPredicate(new WqlPredicate<TestIndexItem>("within", _ => x => ids.Contains(x.Id)));
                }

                return parser;
            }

            /// <summary>
            /// Applies the board filter of the base class to an empty query.
            /// </summary>
            /// <param name="wql">The WQL filter.</param>
            /// <returns>The filtered query.</returns>
            public IQuery<TestIndexItem> Apply(string wql)
            {
                return ApplyWql(wql, new Query<TestIndexItem>(), null);
            }
        }

        /// <summary>
        /// A quickfilter that keeps the default query mode or chooses one.
        /// </summary>
        /// <param name="mode">The query mode, or null for the default.</param>
        private sealed class ModeQuickfilter(WqlQueryMode? mode) : RestApiQuickfilter<TestIndexItem>
        {
            /// <summary>
            /// Returns the chosen mode, or the default of the base class.
            /// </summary>
            protected override WqlQueryMode QueryMode => mode ?? base.QueryMode;

            /// <summary>
            /// Turns criteria into a query through the base class.
            /// </summary>
            /// <param name="criteria">The WQL criteria.</param>
            /// <returns>The query, or null.</returns>
            public IQuery<TestIndexItem> Criteria(string criteria)
            {
                return ToQuery(criteria);
            }

            /// <summary>
            /// Returns no filters, which the test does not need.
            /// </summary>
            /// <param name="context">The query context.</param>
            /// <param name="request">The request.</param>
            /// <returns>No filters.</returns>
            protected override IEnumerable<RestApiQuickfilterItem> RetrieveItems(IQueryContext context, IRequest request)
            {
                return [];
            }
        }
    }
}
