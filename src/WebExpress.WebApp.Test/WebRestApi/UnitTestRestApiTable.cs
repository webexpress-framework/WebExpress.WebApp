using System.Text.Json;
using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.Test.Model;

namespace WebExpress.WebApp.Test.WebRestApi
{
    /// <summary>
    /// Provides unit tests for verifying the behavior of the TestRestApiTable class.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestRestApiTable
    {
        /// <summary>
        /// Tests that the table title is set correctly when a new instance of the 
        /// TestRestApiTable is created.
        /// </summary>
        [Fact]
        public void SetTitle()
        {
            // test execution
            var table = new TestRestApiTable([], "my title");

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
            // preconditions
            var item = new TestIndexItem
            {
                Id = Guid.NewGuid(),
                Key = "A1",
                Names = ["Anna", "Bob"],
                State = "Active",
                Description = "hidden desc"
            };
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var table = new TestRestApiTable<TestIndexItem>([item], "Title");
            var request = UnitTestControlFixture.CreateRequestMock();

            // test execution
            var result = table.Retrieve(request);

            // vallidation
            Assert.NotNull(result);
            Assert.Equal(200, result.Status);

            using var doc = JsonDocument.Parse((byte[])result.Content);
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

            Assert.NotNull(rows[0].GetProperty("id").GetString()); // die id ist ein GUID-String
            var cells = rows[0].GetProperty("cells").EnumerateArray().ToList();
            Assert.Equal(4, cells.Count);

            Assert.Equal("A1", cells[0].GetProperty("text").GetString());
            Assert.Equal("Anna;Bob", cells[1].GetProperty("text").GetString());
            Assert.Equal("Active", cells[2].GetProperty("text").GetString());
            Assert.Equal("hidden desc", cells[3].GetProperty("text").GetString());

            var options = rows[0].GetProperty("options").EnumerateArray().ToList();
            Assert.Single(options);

            var option = options[0];
            Assert.Equal("RestApiCrudTableRowOptionEdit", option.GetProperty("$type").GetString());
            Assert.Equal("item", option.GetProperty("type").GetString());
            Assert.Equal("edit", option.GetProperty("command").GetString());
            Assert.Null(option.GetProperty("uri").GetString());
            Assert.Equal("Edit", option.GetProperty("text").GetString());
            Assert.Equal("fa fa-pen", option.GetProperty("icon").GetString());
            Assert.Equal("text-primary", option.GetProperty("color").GetString());
            Assert.Null(option.GetProperty("modal").GetString());
            Assert.Null(option.GetProperty("id").GetString());

            Assert.True(rows[0].TryGetProperty("icon", out var iconElement) && iconElement.ValueKind == JsonValueKind.Null);
            Assert.True(rows[0].TryGetProperty("image", out var imageElement) && imageElement.ValueKind == JsonValueKind.Null);
            Assert.True(rows[0].TryGetProperty("uri", out var uriElement) && uriElement.ValueKind == JsonValueKind.Null);
        }

        /// <summary>
        /// Verifies that the template tag functionality correctly retrieves and 
        /// validates table column data in a REST API scenario.
        /// </summary>
        [Fact]
        public void TemplateTag()
        {
            // preconditions
            var item = new TestIndexItemTemplateTag
            {
                Id = Guid.NewGuid()
            };
            var table = new TestRestApiTable<TestIndexItemTemplateTag>([item], "Title");
            var request = UnitTestControlFixture.CreateRequestMock();

            // test execution
            var result = table.Retrieve(request);

            // vallidation
            Assert.NotNull(result);
            Assert.Equal(200, result.Status);

            using var doc = JsonDocument.Parse((byte[])result.Content);
            var root = doc.RootElement;

            var columns = root.GetProperty("columns").EnumerateArray().ToList();
            Assert.Equal(3, columns.Count);

            //var buf = columns[0].GetRawText();

            var template = columns[0].GetProperty("template");
            Assert.Equal("tag", template.GetProperty("type").GetString());

            var options = template.GetProperty("options");
            Assert.True(options.GetProperty("editable").GetBoolean());
            Assert.Equal("", options.GetProperty("colorCss").GetString());
            Assert.Equal(JsonValueKind.Null, options.GetProperty("placeholder").ValueKind);

            template = columns[1].GetProperty("template");
            Assert.Equal("tag", template.GetProperty("type").GetString());

            options = template.GetProperty("options");
            Assert.False(options.GetProperty("editable").GetBoolean());
            Assert.Equal("wx-tag-warning", options.GetProperty("colorCss").GetString());
            Assert.Equal(JsonValueKind.Null, options.GetProperty("placeholder").ValueKind);

            template = columns[2].GetProperty("template");
            Assert.Equal("tag", template.GetProperty("type").GetString());

            options = template.GetProperty("options");
            Assert.False(options.GetProperty("editable").GetBoolean());
            Assert.Equal("", options.GetProperty("colorCss").GetString());
            Assert.Equal("hello webexpress", options.GetProperty("placeholder").GetString());
        }
    }
}
