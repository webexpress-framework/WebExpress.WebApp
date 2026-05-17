using System.Text;
using System.Text.Json;
using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebRestApi;

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
                        Icon = "fas fa-ship",
                        TemplateId = "template-1",
                        Uri = "/api/tab/1",
                        Color = "text-primary",
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
            Assert.Equal("fas fa-ship", first.GetProperty("icon").GetString());
            Assert.Equal("template-1", first.GetProperty("templateId").GetString());
            Assert.Equal("/api/tab/1", first.GetProperty("uri").GetString());
            Assert.Equal("text-primary", first.GetProperty("color").GetString());
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
        }
    }
}
