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
    /// start and its functions where a value may stand, and that the arguments of a predicate
    /// are not taken for values of an attribute.
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
            // act
            var (suggestions, _) = Analyze(wql, cursor);

            // validation
            Assert.Equal(values.Order(), suggestions.Order());
        }

        /// <summary>
        /// Tests that a predicate is offered only where a condition may start and a scalar
        /// function only where a value may stand, with the cursor at the end of the statement.
        /// </summary>
        /// <param name="wql">The statement typed so far.</param>
        /// <param name="offered">A suggestion that is offered, or null.</param>
        /// <param name="withheld">A suggestion that is not offered.</param>
        [Theory]
        [InlineData("Description ~ \"A item\" order by ", "Description", "within")]
        [InlineData("Description ~ \"A item\" order by w", null, "within")]
        [InlineData("within(\"A\", ", "value of nothing", "within")]
        [InlineData("within(\"A\", ", "value of nothing", "now")]
        [InlineData("Description ~ concat(Description, ", "now", "within")]
        [InlineData("Description ~ concat(Description, ", "value of Description", "within")]
        [InlineData("Description ~ no", null, "within")]
        public void SuggestionsByPosition(string wql, string offered, string withheld)
        {
            // act
            var (suggestions, _) = Analyze(wql, wql.Length);

            // validation
            if (offered is not null)
            {
                Assert.Contains(offered, suggestions);
            }

            Assert.DoesNotContain(withheld, suggestions);
        }

        /// <summary>
        /// Tests that the names of predicates and functions are reported as calls, so the client
        /// completes them with their opening parenthesis, while attributes and values are not.
        /// </summary>
        /// <param name="wql">The statement typed so far.</param>
        /// <param name="cursor">The cursor position.</param>
        /// <param name="calls">The expected calls.</param>
        [Theory]
        [InlineData("wi", 2, "within")]
        [InlineData("Description ~ no()", 16, "now")]
        [InlineData("", 0, "within")]
        [InlineData("Description ~ \"A item\" order by ", 32)]
        [InlineData("within(\"", 8)]
        public void Calls(string wql, int cursor, params string[] calls)
        {
            // act
            var (_, actual) = Analyze(wql, cursor);

            // validation
            Assert.Equal(calls.Order(), actual.Order());
        }

        /// <summary>
        /// Asks the prompt for the suggestions at a cursor position.
        /// </summary>
        /// <param name="wql">The statement typed so far.</param>
        /// <param name="cursor">The cursor position.</param>
        /// <returns>The suggestions and those among them that are calls.</returns>
        private static (List<string> Suggestions, List<string> Calls) Analyze(string wql, int cursor)
        {
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var prompt = new PredicatePrompt();
            var request = UnitTestControlFixture.CreateRequestMock(uri: $"/api/analyze?wql={Uri.EscapeDataString(wql)}&c={cursor}");

            var result = prompt.Get(request);

            using var doc = JsonDocument.Parse(Encoding.UTF8.GetString((byte[])result.Content));

            List<string> Read(string name) => doc.RootElement.GetProperty(name)
                .EnumerateArray()
                .Select(x => x.GetString())
                .ToList();

            return (Read("suggestions"), Read("calls"));
        }
    }
}
