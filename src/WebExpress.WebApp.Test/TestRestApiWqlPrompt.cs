using WebExpress.WebApp.Test.Model;
using WebExpress.WebApp.WebRestApi;
using WebExpress.WebIndex;

namespace WebExpress.WebApp.Test
{
    /// <summary>
    /// Represents a wql prompt of test index items for use with REST API scenarios.
    /// </summary>
    public sealed class TestRestApiWqlPrompt : TestRestApiWqlPrompt<TestIndexItem>
    {
        /// <summary>
        /// Initializes a new instance of the class with the specified data .
        /// </summary>
        public TestRestApiWqlPrompt()
            : base()
        {
        }
    }

    /// <summary>
    /// Provides a test implementation of a REST API wql prompt for retrieving 
    /// index items using WQL statements.
    /// </summary>
    public class TestRestApiWqlPrompt<TIndexItem> : RestApiWqlPrompt<TIndexItem>
        where TIndexItem : IIndexItem
    {
        /// <summary>
        /// Initializes a new instance of the class with the specified data and optional table title.
        /// </summary>
        public TestRestApiWqlPrompt()
        {
        }

        /// <summary>
        /// Retrieves a collection of suggested strings that match the specified prefix 
        /// and are influenced by the provided attribute.
        /// </summary>
        /// <param name="prefix">The prefix used to filter suggestions. This parameter must not be null or empty.</param>
        /// <param name="attribute">An attribute that affects the context or criteria for generating suggestions.</param>
        /// <returns>
        /// An enumerable collection of strings containing suggestions that correspond 
        /// to the given prefix and attribute. The collection will be empty if no suggestions are found.
        /// </returns>
        protected override IEnumerable<string> GetSuggestions(string prefix, string attribute)
        {
            return ["A item", "B item", "C item"];
        }
    }
}
