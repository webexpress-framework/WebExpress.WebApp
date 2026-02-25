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
    }
}
