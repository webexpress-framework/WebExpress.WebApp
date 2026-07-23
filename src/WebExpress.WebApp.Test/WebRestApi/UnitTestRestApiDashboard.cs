using System.Text;
using System.Text.Json;
using WebExpress.WebApp.Test.Fixture;

namespace WebExpress.WebApp.Test.WebRestApi
{
    /// <summary>
    /// Provides unit tests for verifying the behavior of the RestApiDashboard class.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestRestApiDashboard
    {
        /// <summary>
        /// Tests that the tile title is set correctly when a new instance of the 
        /// RestApiDashboard is created.
        /// </summary>
        [Fact]
        public void SetTitle()
        {
            // act
            var table = new TestRestApiDashboard("my title");

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
            var tile = new TestRestApiDashboard("Title");
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
            var items = root.GetProperty("columns").EnumerateArray().ToList();
            Assert.Empty(items);

            // the available widgets are always emitted, empty by default
            var widgets = root.GetProperty("availableWidgets").EnumerateArray().ToList();
            Assert.Empty(widgets);
        }

        /// <summary>
        /// Verifies that a PUT carrying a column-layout change (rename / reorder /
        /// delete) reaches the column-update hook with the ordered column list.
        /// </summary>
        [Fact]
        public void UpdateColumnLayout()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiDashboard();
            var request = UnitTestControlFixture.CreateRequestMock
            (
                "PUT / HTTP/1.1\r\n" +
                "Host: localhost\r\n" +
                "Content-Type: application/json\r\n" +
                "\r\n" +
                "{\"action\":\"columns\",\"columns\":[{\"id\":\"a\",\"title\":\"Alpha\",\"size\":\"33%\"},{\"id\":\"b\",\"title\":\"Beta\"}]}",
                "https://example.com/"
            );

            // act
            var result = api.Update(request);

            // validation
            Assert.NotNull(result);
            Assert.Equal(200, result.Status);
            Assert.Equal("columns", api.LastAction);
            Assert.NotNull(api.LastColumns);
            Assert.Equal(2, api.LastColumns.Count);
            Assert.Equal("a", api.LastColumns[0].Id);
            Assert.Equal("Alpha", api.LastColumns[0].Title);
            Assert.Equal("33%", api.LastColumns[0].Size);
            Assert.Equal("b", api.LastColumns[1].Id);
        }

        /// <summary>
        /// Verifies that a PUT carrying a full board (widget add / delete /
        /// settings) reaches the board-update hook with the per-widget name,
        /// color and params, and does not fall through to the column hook.
        /// </summary>
        [Fact]
        public void UpdateBoardLayout()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiDashboard();
            var request = UnitTestControlFixture.CreateRequestMock
            (
                "PUT / HTTP/1.1\r\n" +
                "Host: localhost\r\n" +
                "Content-Type: application/json\r\n" +
                "\r\n" +
                "{\"action\":\"settings\",\"board\":[{\"id\":\"a\",\"title\":\"Alpha\",\"size\":\"1fr\"," +
                "\"widgets\":[{\"id\":\"widget_scrum_velocity\",\"title\":\"Velocity\",\"color\":\"#00bcd4\"," +
                "\"params\":{\"maxSprints\":\"8\"}}]}]}",
                "https://example.com/"
            );

            // act
            var result = api.Update(request);

            // validation
            Assert.NotNull(result);
            Assert.Equal(200, result.Status);
            Assert.Null(api.LastColumns);
            Assert.NotNull(api.LastBoard);
            Assert.Single(api.LastBoard);
            Assert.Equal("a", api.LastBoard[0].Id);
            var widget = Assert.Single(api.LastBoard[0].Widgets);
            Assert.Equal("widget_scrum_velocity", widget.Id);
            Assert.Equal("Velocity", widget.Title);
            Assert.Equal("#00bcd4", widget.Color);
            Assert.Equal("8", widget.Params["maxSprints"]);
        }
    }
}
