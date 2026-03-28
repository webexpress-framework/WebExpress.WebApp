using System.Text;
using System.Text.Json;
using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.Test.Model;

namespace WebExpress.WebApp.Test.WebRestApi
{
    /// <summary>
    /// Provides unit tests for verifying the behavior of the RestApiTile class.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestRestApiTile
    {
        /// <summary>
        /// Tests that the tile title is set correctly when a new instance of the 
        /// RestApiTile is created.
        /// </summary>
        [Fact]
        public void SetTitle()
        {
            // act
            var table = new TestRestApiTile([], "my title");

            // vallidation
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
            var item = new TestIndexItem
            {
                Id = Guid.NewGuid(),
                Key = "A1",
                Names = ["Anna", "Bob"],
                State = "Active",
                Description = "hidden desc"
            };
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var tile = new TestRestApiTile<TestIndexItem>([item], "Title");
            var request = UnitTestControlFixture.CreateRequestMock();

            // act
            var result = tile.Retrieve(request);

            // vallidation
            Assert.NotNull(result);
            Assert.Equal(200, result.Status);

            var json = Encoding.UTF8.GetString((byte[])result.Content);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            Assert.Equal("Title", root.GetProperty("title").GetString());
            var items = root.GetProperty("items").EnumerateArray().ToList();
            Assert.Single(items);

            Assert.NotEmpty(items[0].GetProperty("title").GetString());
            Assert.NotEmpty(items[0].GetProperty("text").GetString());
            Assert.Null(items[0].GetProperty("icon").GetString());

            var options = items[0].GetProperty("options").EnumerateArray().ToList();
            Assert.Single(options);

            var option = options[0];
            Assert.Equal("item", option.GetProperty("type").GetString());
            Assert.Equal("edit", option.GetProperty("command").GetString());
            Assert.Equal("Edit", option.GetProperty("text").GetString());
            Assert.Equal("fa fa-pen", option.GetProperty("icon").GetString());
            Assert.Equal("text-primary", option.GetProperty("color").GetString());
            Assert.NotNull(option.GetProperty("id").GetString());

            Assert.True(items[0].TryGetProperty("icon", out var iconElement) && iconElement.ValueKind == JsonValueKind.Null);
            Assert.True(items[0].TryGetProperty("image", out var imageElement) && imageElement.ValueKind == JsonValueKind.Null);
            Assert.True(items[0].TryGetProperty("uri", out var uriElement) && uriElement.ValueKind == JsonValueKind.Null);
        }
    }
}
