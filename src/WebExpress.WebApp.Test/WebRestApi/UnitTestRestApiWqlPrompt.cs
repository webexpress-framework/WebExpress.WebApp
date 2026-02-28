using System.Text;
using System.Text.Json;
using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.Test.Model;

namespace WebExpress.WebApp.Test.WebRestApi
{
    /// <summary>
    /// Provides unit tests for verifying the behavior of the rest api wql prompt class.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestRestApiWqlPrompt
    {
        /// <summary>
        /// Verifies that the Retrieve method returns the correct cell values for both joined 
        /// and simple fields.
        /// </summary>
        [Fact]
        public void RetrieveHistory()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var wqlApi = new TestRestApiWqlPrompt<TestIndexItem>();
            var request = UnitTestControlFixture.CreateRequestMock(uri: "/api/history");

            // act
            var result = wqlApi.Get(request);

            // vallidation
            Assert.NotNull(result);
            Assert.Equal(200, result.Status);
        }

        /// <summary>
        /// Validates that the suggestions returned by the WQL API match the expected values 
        /// for a given query.
        /// </summary>
        [Theory]
        [InlineData("", 0, "Id", "Key", "Names", "State", "Description", "Icon", "Uri")]
        [InlineData("D", 1, "Description")]
        [InlineData("Description", 0, "Id", "Key", "Names", "State", "Description", "Icon", "Uri")]
        [InlineData("Description ", 12, "~", "=", "!=", ">", "<", ">=", "<=", "is", "is not", "in", "not in")]
        [InlineData("Description ~", 13, "~")]
        [InlineData("Description >", 13, ">", ">=")]
        [InlineData("Description ~ ", 14, "A item", "B item", "C item")]
        public void Suggestions(string wql, int cursor, params string[] values)
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            string encoded = Uri.EscapeDataString(wql);
            var wqlApi = new TestRestApiWqlPrompt<TestIndexItem>();
            var request = UnitTestControlFixture.CreateRequestMock(uri: $"/api/analyze?wql={encoded}&c={cursor}");
            var items = new List<TestIndexItem>();

            // act
            var result = wqlApi.Get(request);

            // vallidation
            Assert.NotNull(result);
            Assert.NotNull(result.Content);
            Assert.Equal(200, result.Status);

            var json = Encoding.UTF8.GetString((byte[])result.Content);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            var suggestions = root.GetProperty("suggestions")
                .EnumerateArray()
                .Select(x => x.GetString())
                .ToList();
            Assert.Equal(values.Length, suggestions.Count);
            Assert.True(values.All(v => suggestions.Contains(v)));
        }
    }
}
