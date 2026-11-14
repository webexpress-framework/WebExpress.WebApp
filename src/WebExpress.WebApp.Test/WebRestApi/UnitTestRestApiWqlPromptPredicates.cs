using System.Text;
using System.Text.Json;
using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.Test.Model;
using WebExpress.WebIndex.Wql;
using WebExpress.WebIndex.Wql.Predicate;

namespace WebExpress.WebApp.Test.WebRestApi
{
    /// <summary>
    /// Tests that the wql prompt offers the predicates of its parser where a condition may
    /// start, and that the arguments of a predicate are not taken for values of an attribute.
    /// </summary>
    public class UnitTestRestApiWqlPromptPredicates
    {
        /// <summary>
        /// A prompt whose parser knows within(&lt;group&gt;) and whose value suggestions name the
        /// attribute they were asked for.
        /// </summary>
        private sealed class PredicatePrompt : TestRestApiWqlPrompt<TestIndexItem>
        {
            /// <summary>
            /// Creates the parser with the predicate.
            /// </summary>
            /// <returns>The parser.</returns>
            protected override WqlParser<TestIndexItem> CreateWqlParser()
            {
                var parser = base.CreateWqlParser();
                parser.RegisterPredicate(new WqlPredicate<TestIndexItem>("within", _ => x => true));

                return parser;
            }

            /// <summary>
            /// Returns one value that names the attribute it belongs to.
            /// </summary>
            /// <param name="prefix">The prefix typed so far.</param>
            /// <param name="attribute">The attribute the value is for.</param>
            /// <returns>The value.</returns>
            protected override IEnumerable<string> GetSuggestions(string prefix, string attribute)
            {
                return [$"value of {attribute ?? "nothing"}"];
            }
        }

        /// <summary>
        /// Tests the suggestions at a cursor position.
        /// </summary>
        /// <param name="wql">The statement typed so far.</param>
        /// <param name="cursor">The cursor position.</param>
        /// <param name="values">The expected suggestions.</param>
        [Theory]
        [InlineData("", 0, "Id", "Key", "Names", "State", "Description", "Icon", "Uri", "within", "not")]
        [InlineData("w", 1, "within")]
        [InlineData("Description ~ \"A item\" and ", 27, "Id", "Key", "Names", "State", "Description", "Icon", "Uri", "within", "(", "not")]
        [InlineData("Description ~ \"A item\" and within(\"", 35, "value of nothing")]
        [InlineData("within(\"A\") and Description ~ \"", 31, "value of Description")]
        public void Suggestions(string wql, int cursor, params string[] values)
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var prompt = new PredicatePrompt();
            var request = UnitTestControlFixture.CreateRequestMock(uri: $"/api/analyze?wql={Uri.EscapeDataString(wql)}&c={cursor}");

            // act
            var result = prompt.Get(request);

            // validation
            using var doc = JsonDocument.Parse(Encoding.UTF8.GetString((byte[])result.Content));
            var suggestions = doc.RootElement.GetProperty("suggestions")
                .EnumerateArray()
                .Select(x => x.GetString())
                .ToList();

            Assert.Equal(values.Order(), suggestions.Order());
        }
    }
}
