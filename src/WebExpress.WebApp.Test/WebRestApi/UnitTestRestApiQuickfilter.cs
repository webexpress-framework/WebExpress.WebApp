using System.Text;
using System.Text.Json;
using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.Test.Model;

namespace WebExpress.WebApp.Test.WebRestApi
{
    /// <summary>
    /// Provides unit tests for verifying the behavior of the RestApiQuickfilter class.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestRestApiQuickfilter
    {
        /// <summary>
        /// Verifies that the Retrieve method returns the correct cell values for both joined 
        /// and simple fields.
        /// </summary>
        [Fact]
        public void Retrieve()
        {
            // arrange
            var item = new TestIndexItem
            {
                Id = Guid.NewGuid(),
                Key = "A1",
                Names = ["Anna", "Bob"],
                State = "Active",
                Description = "hidden desc"
            };
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var quickfilter = new TestRestApiQuickfilter([item]);
            var request = UnitTestControlFixture.CreateRequestMock();

            // act
            var result = quickfilter.Retrieve(request);

            // vallidation
            Assert.NotNull(result);
            Assert.Equal(200, result.Status);

            var json = Encoding.UTF8.GetString((byte[])result.Content);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            var items = root.GetProperty("filters").EnumerateArray().ToList();
            Assert.Single(items);

            Assert.NotEmpty(items[0].GetProperty("name").GetString());
        }
    }
}
