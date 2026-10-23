using System.Text;
using System.Text.Json;
using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebRestApi;
using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.Test.WebRestApi
{
    /// <summary>
    /// Provides unit tests for RestApiTab.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestRestApiTab
    {
        /// <summary>
        /// Tests that title is read from the title attribute.
        /// </summary>
        [Fact]
        public void SetTitle()
        {
            // act
            var tab = new TestRestApiTab();

            // validation
            Assert.Equal("my title", tab.Title);
        }

        /// <summary>
        /// Verifies GET response shape including items and binding payload.
        /// </summary>
        [Fact]
        public void Retrieve()
        {
            // arrange
            var tab = new TestRestApiTab
            (
                [
                    new RestApiTabView
                    {
                        Id = "tab-1",
                        Title = "Tab 1",
                        Name = "Name 1",
                        Icon = "wx-icon-light wx-icon-light-ship",
                        TemplateId = "template-1",
                        Uri = "/api/tab/1",
                        Color = "text-primary",
                        Badge = "12",
                        BadgeColor = new PropertyColorBackgroundBadge(TypeColorBackgroundBadge.Danger),
                        PrimaryAction = "open",
                        PrimaryTarget = "self",
                        Binding = new
                        {
                            title = "Tab 1",
                            name = "Name 1"
                        }
                    }
                ]
            );
            var request = UnitTestControlFixture.CreateRequestMock();

            // act
            var result = tab.Retrieve(request);

            // validation
            Assert.NotNull(result);
            Assert.Equal(200, result.Status);

            var json = Encoding.UTF8.GetString((byte[])result.Content);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            var items = root.GetProperty("items").EnumerateArray().ToList();
            Assert.Single(items);

            var first = items[0];
            Assert.Equal("tab-1", first.GetProperty("id").GetString());
            Assert.Equal("Tab 1", first.GetProperty("label").GetString());
            Assert.Equal("Name 1", first.GetProperty("name").GetString());
            Assert.Equal("wx-icon-light wx-icon-light-ship", first.GetProperty("icon").GetString());
            Assert.Equal("template-1", first.GetProperty("templateId").GetString());
            Assert.Equal("/api/tab/1", first.GetProperty("uri").GetString());
            Assert.Equal("text-primary", first.GetProperty("color").GetString());

            // the badge carries the count; the typed badge color collapses into
            // its css class
            Assert.Equal("12", first.GetProperty("badge").GetString());
            Assert.Equal("text-bg-danger", first.GetProperty("badgeColor").GetString());
            Assert.Equal("open", first.GetProperty("primaryAction").GetString());
            Assert.Equal("self", first.GetProperty("primaryTarget").GetString());
            Assert.Equal("Tab 1", first.GetProperty("binding").GetProperty("title").GetString());
            Assert.Equal("Name 1", first.GetProperty("binding").GetProperty("name").GetString());
        }

        /// <summary>
        /// Verifies POST response returns newTab and forwards templateId from request body.
        /// </summary>
        [Fact]
        public void CreateWithTemplateId()
        {
            // arrange
            var tab = new TestRestApiTab();
            var request = UnitTestControlFixture.CreateRequestMock
            (
                "POST /api/tab HTTP/1.1\r\n" +
                "Host: localhost\r\n" +
                "Content-Type: application/json\r\n" +
                "\r\n" +
                "{\"action\":\"create\",\"templateId\":\"monkeyTemplate\"}",
                ""
            );

            // act
            var result = tab.Create(request);

            // validation
            Assert.NotNull(result);
            Assert.Equal(201, result.Status);
            Assert.Equal("monkeyTemplate", tab.LastCreateTemplateId);

            var json = Encoding.UTF8.GetString((byte[])result.Content);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            var newTab = root.GetProperty("newTab");

            Assert.Equal("new-tab", newTab.GetProperty("id").GetString());
            var newTabTitle = newTab.TryGetProperty("label", out var labelProperty)
                ? labelProperty.GetString()
                : newTab.GetProperty("title").GetString();
            Assert.Equal("New Tab", newTabTitle);
            Assert.Equal("monkeyTemplate", newTab.GetProperty("templateId").GetString());

            // the badge survives the create path, where the interface is
            // serialized instead of the concrete view
            Assert.Equal("1", newTab.GetProperty("badge").GetString());
        }

        /// <summary>
        /// Verifies that a PUT with the rename action reaches RenameView with a
        /// trimmed label instead of being read as a reorder.
        /// </summary>
        [Fact]
        public void UpdateRename()
        {
            // arrange
            var tab = new TestRestApiTab([new RestApiTabView { Id = "tab-1", Title = "Tab 1" }]);
            var request = CreatePutRequest("{\"action\":\"rename\",\"id\":\"tab-1\",\"label\":\"  Renamed  \"}");

            // act
            var result = tab.Update(request);

            // validation
            Assert.Equal(204, result.Status);
            Assert.Equal(("tab-1", "Renamed"), tab.LastRename);
            Assert.Null(tab.LastOrder);
        }

        /// <summary>
        /// Verifies that an incomplete or refused rename is answered with 400 and
        /// stores nothing, so the client puts the previous label back.
        /// </summary>
        [Theory]
        [InlineData("{\"action\":\"rename\",\"id\":\"tab-1\",\"label\":\"   \"}")]
        [InlineData("{\"action\":\"rename\",\"label\":\"Renamed\"}")]
        [InlineData("{\"action\":\"rename\",\"id\":\"unknown\",\"label\":\"Renamed\"}")]
        [InlineData("{\"action\":\"rename\",\"id\":\"tab-1\",\"label\":\"Bell" + "\\" + "u0007\"}")]
        [InlineData("{\"action\":\"rename\",\"id\":\"tab-1\",\"label\":\"Spoof" + "\\" + "u202Egpj.exe\"}")]
        [InlineData("{\"action\":\"rename\",\"id\":\"tab-1\",\"label\":\"Isolate" + "\\" + "u2066x\"}")]
        public void UpdateRenameRejected(string body)
        {
            // arrange
            var tab = new TestRestApiTab([new RestApiTabView { Id = "tab-1", Title = "Tab 1" }]);

            // act
            var result = tab.Update(CreatePutRequest(body));

            // validation
            Assert.Equal(400, result.Status);
            Assert.Null(tab.LastRename);
        }

        /// <summary>
        /// Verifies that the label length is bounded at the endpoint, with the
        /// limit itself still accepted.
        /// </summary>
        [Theory]
        [InlineData(200, 204)]
        [InlineData(201, 400)]
        public void UpdateRenameLength(int length, int status)
        {
            // arrange
            var tab = new TestRestApiTab([new RestApiTabView { Id = "tab-1", Title = "Tab 1" }]);
            var label = new string('x', length);

            // act
            var result = tab.Update(CreatePutRequest("{\"action\":\"rename\",\"id\":\"tab-1\",\"label\":\"" + label + "\"}"));

            // validation
            Assert.Equal(status, result.Status);
            Assert.Equal(status == 204, tab.LastRename is not null);
        }

        /// <summary>
        /// Verifies that a PUT with the color action reaches RecolorView, with null
        /// removing the color.
        /// </summary>
        [Theory]
        [InlineData("{\"action\":\"color\",\"id\":\"tab-1\",\"color\":\"#0D6efd\"}", "#0D6efd")]
        [InlineData("{\"action\":\"color\",\"id\":\"tab-1\",\"color\":null}", null)]
        public void UpdateColor(string body, string color)
        {
            // arrange
            var tab = new TestRestApiTab([new RestApiTabView { Id = "tab-1", Title = "Tab 1" }]);

            // act
            var result = tab.Update(CreatePutRequest(body));

            // validation
            Assert.Equal(204, result.Status);
            Assert.Equal(("tab-1", color), tab.LastRecolor);
            Assert.Null(tab.LastRename);
            Assert.Null(tab.LastOrder);
        }

        /// <summary>
        /// Verifies that anything but a plain #rrggbb value is refused, so a stored
        /// color can never carry more css into the pages of other users.
        /// </summary>
        [Theory]
        [InlineData("{\"action\":\"color\",\"id\":\"tab-1\",\"color\":\"red\"}")]
        [InlineData("{\"action\":\"color\",\"id\":\"tab-1\",\"color\":\"#12345g\"}")]
        [InlineData("{\"action\":\"color\",\"id\":\"tab-1\",\"color\":\"#123\"}")]
        [InlineData("{\"action\":\"color\",\"id\":\"tab-1\",\"color\":\"#123456;background:url(x)\"}")]
        [InlineData("{\"action\":\"color\",\"color\":\"#123456\"}")]
        [InlineData("{\"action\":\"color\",\"id\":\"unknown\",\"color\":\"#123456\"}")]
        public void UpdateColorRejected(string body)
        {
            // arrange
            var tab = new TestRestApiTab([new RestApiTabView { Id = "tab-1", Title = "Tab 1" }]);

            // act
            var result = tab.Update(CreatePutRequest(body));

            // validation
            Assert.Equal(400, result.Status);
            Assert.Null(tab.LastRecolor);
        }

        /// <summary>
        /// Verifies that the tab color is served under its own key, apart from the
        /// icon color class.
        /// </summary>
        [Fact]
        public void RetrieveTabColor()
        {
            // arrange
            var tab = new TestRestApiTab([new RestApiTabView { Id = "tab-1", Title = "Tab 1", Color = "text-primary", TabColor = "#198754" }]);

            // act
            var result = tab.Retrieve(UnitTestControlFixture.CreateRequestMock());

            // validation
            using var doc = JsonDocument.Parse(Encoding.UTF8.GetString((byte[])result.Content));
            var item = doc.RootElement.GetProperty("items")[0];
            Assert.Equal("#198754", item.GetProperty("tabColor").GetString());
            Assert.Equal("text-primary", item.GetProperty("color").GetString());
        }

        /// <summary>
        /// Verifies that a reorder body still reaches ReorderViews next to the rename.
        /// </summary>
        [Fact]
        public void UpdateReorder()
        {
            // arrange
            var tab = new TestRestApiTab();

            // act
            var result = tab.Update(CreatePutRequest("{\"action\":\"reorder\",\"order\":[\"b\",\"a\"]}"));

            // validation
            Assert.Equal(204, result.Status);
            Assert.Equal(["b", "a"], tab.LastOrder);
            Assert.Null(tab.LastRename);
        }

        /// <summary>
        /// Creates a PUT request carrying the given JSON body.
        /// </summary>
        /// <param name="body">The JSON body.</param>
        /// <returns>The request.</returns>
        private static WebExpress.WebCore.WebMessage.IRequest CreatePutRequest(string body)
        {
            return UnitTestControlFixture.CreateRequestMock
            (
                "PUT /api/tab HTTP/1.1\r\n" +
                "Host: localhost\r\n" +
                "Content-Type: application/json\r\n" +
                "\r\n" +
                body,
                ""
            );
        }
    }
}
