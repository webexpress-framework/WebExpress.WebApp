using System.Text;
using System.Text.Json;
using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.Test.Model;
using WebExpress.WebCore.WebParameter;

namespace WebExpress.WebApp.Test.WebRestApi
{
    /// <summary>
    /// Provides unit tests for verifying the behavior of the RestApiTable class.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestRestApiTable
    {
        /// <summary>
        /// Tests that the table title is set correctly when a new instance of the 
        /// RestApiTable is created.
        /// </summary>
        [Fact]
        public void SetTitle()
        {
            // act
            var table = new TestRestApiTable([], "my title");

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
            var item = new TestIndexItem
            {
                Id = Guid.NewGuid(),
                Key = "A1",
                Names = ["Anna", "Bob"],
                State = "Active",
                Description = "hidden desc"
            };
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var table = new TestRestApiTable([item], "Title");
            var request = UnitTestControlFixture.CreateRequestMock();

            // act
            var result = table.Retrieve(request);

            // validation
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
            Assert.Equal("Edit", option.GetProperty("text").GetString());
            Assert.Equal("fas fa-pen", option.GetProperty("icon").GetString());
            Assert.Equal("text-primary", option.GetProperty("color").GetString());
            Assert.NotNull(option.GetProperty("id").GetString());

            Assert.True(rows[0].TryGetProperty("icon", out var iconElement) && iconElement.ValueKind == JsonValueKind.Null);
            Assert.True(rows[0].TryGetProperty("image", out var imageElement) && imageElement.ValueKind == JsonValueKind.Null);
            Assert.True(rows[0].TryGetProperty("uri", out var uriElement) && uriElement.ValueKind == JsonValueKind.Null);
        }

        /// <summary>
        /// Verifies that a JSON Configure payload reorders the columns, applies
        /// width and visibility, and pushes the resolved layout through
        /// <c>UpdateColumns</c>. Columns omitted by the client must be appended
        /// at the tail and marked hidden.
        /// </summary>
        [Fact]
        public void Configure_JsonBody_AppliesColumnLayout()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var table = new TestRestApiTable([], "Title");
            var body = "{\"c\":[" +
                "{\"id\":\"state\",\"visible\":true,\"width\":120}," +
                "{\"id\":\"key\",\"visible\":false,\"width\":null}," +
                "{\"id\":\"names\",\"visible\":true,\"width\":200}]," +
                "\"r\":[\"r1\",\"r2\"]}";
            var content = $@"PUT /test HTTP/1.1
Host: localhost
Content-Type: application/json

{body}";
            var request = UnitTestControlFixture.CreateRequestMock(content, "/test");

            // act
            var response = table.Configure(request);

            // validation
            Assert.NotNull(response);
            Assert.Equal(200, response.Status);

            Assert.NotNull(table.LastColumnUpdate);
            Assert.Equal(4, table.LastColumnUpdate.Count);

            Assert.Equal("state", table.LastColumnUpdate[0].Id);
            Assert.True(table.LastColumnUpdate[0].Visible);
            Assert.Equal(120u, table.LastColumnUpdate[0].Width);

            Assert.Equal("key", table.LastColumnUpdate[1].Id);
            Assert.False(table.LastColumnUpdate[1].Visible);
            Assert.Null(table.LastColumnUpdate[1].Width);

            Assert.Equal("names", table.LastColumnUpdate[2].Id);
            Assert.True(table.LastColumnUpdate[2].Visible);
            Assert.Equal(200u, table.LastColumnUpdate[2].Width);

            // description was not in the payload - appended at the tail, hidden
            Assert.Equal("description", table.LastColumnUpdate[3].Id);
            Assert.False(table.LastColumnUpdate[3].Visible);

            Assert.NotNull(table.LastRowUpdate);
            Assert.Equal(["r1", "r2"], table.LastRowUpdate);
        }

        /// <summary>
        /// Verifies that unknown and duplicate column ids in the payload are
        /// silently ignored: only ids returned by <c>RetrieveColums</c> survive
        /// validation, and each column appears at most once in the resolved
        /// layout.
        /// </summary>
        [Fact]
        public void Configure_JsonBody_IgnoresUnknownAndDuplicateIds()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var table = new TestRestApiTable([], "Title");
            var body = "{\"c\":[" +
                "{\"id\":\"key\",\"visible\":true,\"width\":80}," +
                "{\"id\":\"does-not-exist\",\"visible\":true,\"width\":50}," +
                "{\"id\":\"KEY\",\"visible\":false,\"width\":999}]}";
            var content = $@"PUT /test HTTP/1.1
Host: localhost
Content-Type: application/json

{body}";
            var request = UnitTestControlFixture.CreateRequestMock(content, "/test");

            // act
            var response = table.Configure(request);

            // validation
            Assert.Equal(200, response.Status);
            Assert.NotNull(table.LastColumnUpdate);

            // 1 valid + 3 untouched columns appended hidden = 4
            Assert.Equal(4, table.LastColumnUpdate.Count);
            Assert.Equal("key", table.LastColumnUpdate[0].Id);
            Assert.True(table.LastColumnUpdate[0].Visible);
            Assert.Equal(80u, table.LastColumnUpdate[0].Width);

            Assert.All(table.LastColumnUpdate.Skip(1), c => Assert.False(c.Visible));
            Assert.Equal(["names", "state", "description"], table.LastColumnUpdate.Skip(1).Select(c => c.Id));

            // row hook untouched
            Assert.Null(table.LastRowUpdate);
        }

        /// <summary>
        /// Verifies that the URL-encoded parameter fallback (parallel
        /// <c>c</c>/<c>v</c>/<c>w</c>/<c>r</c> arrays) is wired through to
        /// <c>UpdateColumns</c>/<c>UpdateRows</c> when no JSON body is supplied.
        /// </summary>
        [Fact]
        public void Configure_UrlEncodedFallback_AppliesLayout()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var table = new TestRestApiTable([], "Title");
            var request = UnitTestControlFixture.CreateRequestMock();
            request.AddParameter(new Parameter("c", "names,state", ParameterScope.Parameter));
            request.AddParameter(new Parameter("v", "1,0", ParameterScope.Parameter));
            request.AddParameter(new Parameter("w", "150,", ParameterScope.Parameter));
            request.AddParameter(new Parameter("r", "row-a,row-b", ParameterScope.Parameter));

            // act
            var response = table.Configure(request);

            // validation
            Assert.Equal(200, response.Status);
            Assert.NotNull(table.LastColumnUpdate);
            Assert.Equal(4, table.LastColumnUpdate.Count);

            Assert.Equal("names", table.LastColumnUpdate[0].Id);
            Assert.True(table.LastColumnUpdate[0].Visible);
            Assert.Equal(150u, table.LastColumnUpdate[0].Width);

            Assert.Equal("state", table.LastColumnUpdate[1].Id);
            Assert.False(table.LastColumnUpdate[1].Visible);
            Assert.Null(table.LastColumnUpdate[1].Width);

            // remaining columns appended at the tail, hidden
            Assert.Equal(["key", "description"], table.LastColumnUpdate.Skip(2).Select(c => c.Id));
            Assert.All(table.LastColumnUpdate.Skip(2), c => Assert.False(c.Visible));

            Assert.Equal(["row-a", "row-b"], table.LastRowUpdate);
        }

        /// <summary>
        /// Verifies that a Configure request without column or row data does not
        /// invoke the <c>UpdateColumns</c>/<c>UpdateRows</c> hooks and still
        /// returns a successful response.
        /// </summary>
        [Fact]
        public void Configure_EmptyPayload_DoesNotInvokeHooks()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var table = new TestRestApiTable([], "Title");
            var request = UnitTestControlFixture.CreateRequestMock();

            // act
            var response = table.Configure(request);

            // validation
            Assert.Equal(200, response.Status);
            Assert.Null(table.LastColumnUpdate);
            Assert.Null(table.LastRowUpdate);
        }

        /// <summary>
        /// Verifies that the template tag functionality correctly retrieves and
        /// validates table column data in a REST API scenario.
        /// </summary>
        [Fact]
        public void TemplateTag()
        {
            // arrange
            var item = new TestIndexItemTemplateTag
            {
                Id = Guid.NewGuid()
            };
            var table = new TestRestApiTableTemplateTag([item], "Title");
            var request = UnitTestControlFixture.CreateRequestMock();

            // act
            var result = table.Retrieve(request);

            // validation
            Assert.NotNull(result);
            Assert.Equal(200, result.Status);

            using var doc = JsonDocument.Parse((byte[])result.Content);
            var root = doc.RootElement;

            var columns = root.GetProperty("columns").EnumerateArray().ToList();
            Assert.Equal(3, columns.Count);

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
