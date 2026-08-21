using System.Text;
using System.Text.Json;
using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebRestApi;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebIcon;

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
            Assert.Equal(JsonValueKind.Null, root.GetProperty("filter").ValueKind);
            var columns = root.GetProperty("columns").EnumerateArray().ToList();
            Assert.Empty(columns);

            var swimlanes = root.GetProperty("swimlanes").EnumerateArray().ToList();
            Assert.Empty(swimlanes);

            var cards = root.GetProperty("items").EnumerateArray().ToList();
            Assert.Empty(cards);
        }

        /// <summary>
        /// Verifies that a footer chip serializes its typed color into the css
        /// class (system color) or the inline style (user-defined color), while
        /// the typed color itself stays off the wire.
        /// </summary>
        [Fact]
        public void SerializeCardChipColor()
        {
            // arrange
            var system = new RestApiKanbanCardChip { Label = "P1", Color = new PropertyColorBackgroundBadge(TypeColorBackgroundBadge.Danger), Title = "Priority" };
            var user = new RestApiKanbanCardChip { Label = "5", Color = new PropertyColorBackgroundBadge("#ff8800") };

            // act
            var systemJson = JsonSerializer.Serialize(system);
            var userJson = JsonSerializer.Serialize(user);

            // validation
            using var systemDoc = JsonDocument.Parse(systemJson);
            Assert.Equal("text-bg-danger", systemDoc.RootElement.GetProperty("colorCss").GetString());
            Assert.Equal(JsonValueKind.Null, systemDoc.RootElement.GetProperty("colorStyle").ValueKind);
            Assert.False(systemDoc.RootElement.TryGetProperty("color", out _));

            using var userDoc = JsonDocument.Parse(userJson);
            Assert.Equal(JsonValueKind.Null, userDoc.RootElement.GetProperty("colorCss").ValueKind);
            Assert.Equal("background:#ff8800;", userDoc.RootElement.GetProperty("colorStyle").GetString());
        }

        /// <summary>
        /// Verifies that a column badge serializes its typed color into the css
        /// class (system color), while the typed color itself stays off the wire.
        /// </summary>
        [Fact]
        public void SerializeColumnBadge()
        {
            // arrange
            var column = new RestApiKanbanColumn { Id = "todo", Label = "To Do", Badge = "3", BadgeColor = new PropertyColorBackgroundBadge(TypeColorBackgroundBadge.Secondary) };

            // act
            var json = JsonSerializer.Serialize(column);

            // validation
            using var doc = JsonDocument.Parse(json);
            Assert.Equal("3", doc.RootElement.GetProperty("badge").GetString());
            Assert.Equal("text-bg-secondary", doc.RootElement.GetProperty("badgeColor").GetString());
            Assert.Equal(JsonValueKind.Null, doc.RootElement.GetProperty("badgeStyle").ValueKind);
            Assert.False(doc.RootElement.TryGetProperty("BadgeColor", out _));
        }

        /// <summary>
        /// Verifies that a footer chip serializes its typed icon into the spec
        /// the client parses: an image icon contributes its picture uri, any
        /// other icon its CSS class, while the typed icon stays off the wire.
        /// </summary>
        [Fact]
        public void SerializeCardChipIcon()
        {
            // arrange
            var glyph = new RestApiKanbanCardChip { Label = "8", Icon = new IconStar() };
            var picture = new RestApiKanbanCardChip { Label = "GT", Icon = new ImageIcon(new UriEndpoint("/img/star.png")) };

            // act
            var glyphJson = JsonSerializer.Serialize(glyph);
            var pictureJson = JsonSerializer.Serialize(picture);

            // validation
            using var glyphDoc = JsonDocument.Parse(glyphJson);
            Assert.Equal("wx-icon-light wx-icon-light-star", glyphDoc.RootElement.GetProperty("icon").GetString());

            using var pictureDoc = JsonDocument.Parse(pictureJson);
            Assert.Equal("/img/star.png", pictureDoc.RootElement.GetProperty("icon").GetString());
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
            var api = new TestRestApiKanban();
            var request = UnitTestControlFixture.CreateRequestMock
            (
                "PUT / HTTP/1.1\r\n" +
                "Host: localhost\r\n" +
                "Content-Type: application/json\r\n" +
                "\r\n" +
                "{\"action\":\"columns\",\"columns\":[{\"id\":\"a\",\"title\":\"Alpha\",\"size\":\"1fr\"},{\"id\":\"b\",\"title\":\"Beta\"}]}",
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
            Assert.Equal("1fr", api.LastColumns[0].Size);
            Assert.Equal("b", api.LastColumns[1].Id);
            Assert.Equal("Beta", api.LastColumns[1].Title);
        }

        /// <summary>
        /// Verifies that a PUT carrying a swimlane-layout change (add / rename /
        /// reorder / delete) reaches the swimlane-update hook with the ordered
        /// swimlane list.
        /// </summary>
        [Fact]
        public void UpdateSwimlaneLayout()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiKanban();
            var request = UnitTestControlFixture.CreateRequestMock
            (
                "PUT / HTTP/1.1\r\n" +
                "Host: localhost\r\n" +
                "Content-Type: application/json\r\n" +
                "\r\n" +
                "{\"action\":\"swimlanes\",\"swimlanes\":[{\"id\":\"melee\",\"title\":\"Mêlée\",\"filter\":\"team = 'a'\",\"color\":\"#198754\"},{\"id\":\"new\",\"title\":\"New lane\"}]}",
                "https://example.com/"
            );

            // act
            var result = api.Update(request);

            // validation
            Assert.NotNull(result);
            Assert.Equal(200, result.Status);
            Assert.Equal("swimlanes", api.LastAction);
            Assert.NotNull(api.LastSwimlanes);
            Assert.Equal(2, api.LastSwimlanes.Count);
            Assert.Equal("melee", api.LastSwimlanes[0].Id);
            Assert.Equal("Mêlée", api.LastSwimlanes[0].Title);
            Assert.Equal("team = 'a'", api.LastSwimlanes[0].Filter);
            Assert.Equal("#198754", api.LastSwimlanes[0].Color);
            Assert.Equal("new", api.LastSwimlanes[1].Id);
            Assert.Equal("New lane", api.LastSwimlanes[1].Title);
            Assert.Null(api.LastSwimlanes[1].Color);
        }

        /// <summary>
        /// Verifies that a PUT carrying a settings change reaches the settings
        /// hook with the wql filter.
        /// </summary>
        [Fact]
        public void UpdateSettingsFilter()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiKanban();
            var request = UnitTestControlFixture.CreateRequestMock
            (
                "PUT / HTTP/1.1\r\n" +
                "Host: localhost\r\n" +
                "Content-Type: application/json\r\n" +
                "\r\n" +
                "{\"action\":\"settings\",\"filter\":\"priority = 'high'\"}",
                "https://example.com/"
            );

            // act
            var result = api.Update(request);

            // validation
            Assert.NotNull(result);
            Assert.Equal(200, result.Status);
            Assert.Equal("settings", api.LastAction);
            Assert.Equal("priority = 'high'", api.LastFilter);
        }
    }
}
