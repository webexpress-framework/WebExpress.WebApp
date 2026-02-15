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
            var columns = root.GetProperty("columns").EnumerateArray().ToList();
            Assert.Equal(4, columns.Count);

            Assert.Equal("Key", columns[0].GetProperty("name").GetString());
            Assert.Equal("Key", columns[0].GetProperty("label").GetString());
            Assert.Null(columns[0].GetProperty("icon").GetString());
            Assert.Null(columns[0].GetProperty("width").GetString());
            Assert.Null(columns[0].GetProperty("template").GetString());

            Assert.Equal("Names", columns[1].GetProperty("name").GetString());
            Assert.Equal("Names", columns[1].GetProperty("label").GetString());
            Assert.Null(columns[1].GetProperty("icon").GetString());
            Assert.Null(columns[1].GetProperty("width").GetString());
            Assert.Null(columns[1].GetProperty("template").GetString());

            Assert.Equal("State", columns[2].GetProperty("name").GetString());
            Assert.Equal("State", columns[2].GetProperty("label").GetString());
            Assert.Null(columns[2].GetProperty("icon").GetString());
            Assert.Null(columns[2].GetProperty("width").GetString());
            Assert.Null(columns[2].GetProperty("template").GetString());

            Assert.Equal("Description", columns[3].GetProperty("name").GetString());
            Assert.Equal("Description", columns[3].GetProperty("label").GetString());
            Assert.Null(columns[3].GetProperty("icon").GetString());
            Assert.Null(columns[3].GetProperty("width").GetString());
            Assert.Null(columns[3].GetProperty("template").GetString());

            var rows = root.GetProperty("rows").EnumerateArray().ToList();
            Assert.Single(rows);

            Assert.NotNull(rows[0].GetProperty("id").GetString());
            var cells = rows[0].GetProperty("cells").EnumerateArray().ToList();
            Assert.Equal(4, cells.Count);

            Assert.Equal("A1", cells[0].GetProperty("content").GetString());
            var array = cells[1].GetProperty("content").EnumerateArray().ToList();
            Assert.Equal(2, array.Count);
            Assert.Equal("Anna", array[0].GetString());
            Assert.Equal("Bob", array[1].GetString());
            Assert.Equal("Active", cells[2].GetProperty("content").GetString());
            Assert.Equal("hidden desc", cells[3].GetProperty("content").GetString());

            var options = rows[0].GetProperty("options").EnumerateArray().ToList();
            Assert.Single(options);

            var option = options[0];
            Assert.Equal("item", option.GetProperty("type").GetString());
            Assert.Equal("edit", option.GetProperty("command").GetString());
            Assert.Null(option.GetProperty("uri").GetString());
            Assert.Equal("Edit", option.GetProperty("text").GetString());
            Assert.Equal("fa fa-pen", option.GetProperty("icon").GetString());
            Assert.Equal("text-primary", option.GetProperty("color").GetString());
            Assert.NotNull(option.GetProperty("id").GetString());

            Assert.True(rows[0].TryGetProperty("icon", out var iconElement) && iconElement.ValueKind == JsonValueKind.Null);
            Assert.True(rows[0].TryGetProperty("image", out var imageElement) && imageElement.ValueKind == JsonValueKind.Null);
            Assert.True(rows[0].TryGetProperty("uri", out var uriElement) && uriElement.ValueKind == JsonValueKind.Null);
        }
    }
}
