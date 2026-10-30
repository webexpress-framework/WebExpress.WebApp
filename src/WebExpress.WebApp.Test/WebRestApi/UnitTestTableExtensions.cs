using System.Linq;
using System.Text.Json;
using WebExpress.WebApp.WebRestApi;

namespace WebExpress.WebApp.Test.WebRestApi
{
    /// <summary>
    /// Protects table layout and row serialization contracts.
    /// </summary>
    public class UnitTestTableExtensions
    {
        /// <summary>
        /// Applies layout changes without altering cached server column definitions.
        /// </summary>
        [Fact]
        public void LayoutMergesSchemaChanges()
        {
            // arrange
            var columns = new[] { new RestApiTableColumn { Id = "a", Visible = true }, new RestApiTableColumn { Id = "b", Visible = true }, new RestApiTableColumn { Id = "new", Visible = true } };
            var stored = """{"version":1,"columns":[{"id":"b","visible":false,"width":120},{"id":"removed"},{"id":"a","visible":true,"width":null}]}""";
            // act
            var result = RestApiTableLayout.Parse(stored).Apply(columns);
            var roundTrip = RestApiTableLayout.Parse(RestApiTableLayout.Capture(result).ToJson());
            // validation
            Assert.Equal(new[] { "b", "a", "new" }, result.Select(column => column.Id));
            Assert.False(result[0].Visible);
            Assert.Equal(120u, result[0].Width);
            Assert.True(columns[1].Visible);
            Assert.Equal(3, roundTrip.Columns.Count);
        }

        /// <summary>
        /// Serializes hierarchy and explicitly formatted cells without response rewriting.
        /// </summary>
        [Fact]
        public void RowContractIncludesChildrenAndMarkupIntent()
        {
            // arrange
            var row = new RestApiTableRow { Id = "parent", Expanded = false, Children = [new RestApiTableRow { Id = "child" }],
                Cells = [new RestApiTableCell { Content = "<b>plain</b>" }, new RestApiTableCell { Content = "<b>trusted</b>", Html = true }] };
            // act
            using var json = JsonDocument.Parse(JsonSerializer.Serialize(row));
            // validation
            var root = json.RootElement;
            Assert.False(root.GetProperty("expanded").GetBoolean());
            Assert.Equal("child", root.GetProperty("children")[0].GetProperty("id").GetString());
            Assert.False(root.GetProperty("cells")[0].GetProperty("html").GetBoolean());
            Assert.True(root.GetProperty("cells")[1].GetProperty("html").GetBoolean());
        }
    }
}
