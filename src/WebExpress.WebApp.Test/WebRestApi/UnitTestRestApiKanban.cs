using System.Text;
using System.Text.Json;
using WebExpress.WebApp.Test.Fixture;

namespace WebExpress.WebApp.Test.WebRestApi
{
    /// <summary>
    /// Provides unit tests for verifying the behavior of the RestApiKanban class.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestRestApiKanban
    {
        /// <summary>
        /// Tests that the tile title is set correctly when a new instance of the 
        /// RestApiDashboard is created.
        /// </summary>
        [Fact]
        public void SetTitle()
        {
            // act
            var table = new TestRestApiKanban("my title");

            // validation
            Assert.Equal("my title", table.Title);
        }

        /// <summary>
        /// Verifies that the Retrieve method returns the correct cell values for both joined 
        /// and simple fields.
        /// </summary>
        [Fact]
        public void Retrieve()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var tile = new TestRestApiKanban("Title");
            var request = UnitTestControlFixture.CreateRequestMock();

            // act
            var result = tile.Retrieve(request);

            // validation
            Assert.NotNull(result);
            Assert.Equal(200, result.Status);

            var json = Encoding.UTF8.GetString((byte[])result.Content);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            Assert.Equal("Title", root.GetProperty("title").GetString());
            var columns = root.GetProperty("columns").EnumerateArray().ToList();
            Assert.Empty(columns);

            var swimlanes = root.GetProperty("swimlanes").EnumerateArray().ToList();
            Assert.Empty(swimlanes);

            var cards = root.GetProperty("items").EnumerateArray().ToList();
            Assert.Empty(cards);
        }
    }
}
