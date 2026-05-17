using System.Text;
using System.Text.Json;
using WebExpress.WebApp.Test.Fixture;

namespace WebExpress.WebApp.Test.WebRestApi
{
    /// <summary>
    /// Provides unit tests for verifying the behavior of the RestApiScrum class.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestRestApiScrum
    {
        /// <summary>
        /// Verifies that the backlog endpoint returns sprints and items.
        /// </summary>
        [Fact]
        public void RetrieveBacklog()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiScrum();
            var request = (WebExpress.WebCore.WebMessage.Request)UnitTestControlFixture.CreateRequestMock("", "https://example.com/api/scrum/backlog");

            // act
            var result = api.Retrieve(request);

            // validation
            Assert.NotNull(result);
            Assert.Equal(200, result.Status);

            var json = Encoding.UTF8.GetString((byte[])result.Content);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            var sprints = root.GetProperty("sprints").EnumerateArray().ToList();
            var items = root.GetProperty("items").EnumerateArray().ToList();

            Assert.Equal(3, sprints.Count);
            Assert.Equal(4, items.Count);

            Assert.Equal("10000000-0000-0000-0000-000000000001", sprints[0].GetProperty("id").GetString());
            Assert.Equal("Sprint 24", sprints[0].GetProperty("name").GetString());
            Assert.Equal("active", sprints[0].GetProperty("status").GetString());

            Assert.Equal("20000000-0000-0000-0000-000000000001", items[0].GetProperty("id").GetString());
            Assert.Equal("story", items[0].GetProperty("type").GetString());
            Assert.Equal("MVP-1", items[0].GetProperty("key").GetString());
        }

        /// <summary>
        /// Verifies that the sprint endpoint returns the active sprint overview.
        /// </summary>
        [Fact]
        public void RetrieveSprint()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiScrumSprint();
            var request = (WebExpress.WebCore.WebMessage.Request)UnitTestControlFixture.CreateRequestMock("", "https://example.com/api/scrum/sprint");

            // act
            var result = api.Retrieve(request);

            // validation
            Assert.NotNull(result);
            Assert.Equal(200, result.Status);

            var json = Encoding.UTF8.GetString((byte[])result.Content);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            Assert.Equal("Sprint 24", root.GetProperty("name").GetString());
            Assert.Equal("Customer-Portal MVP launch-ready", root.GetProperty("goal").GetString());
            Assert.Equal("active", root.GetProperty("status").GetString());
            Assert.Equal("2026-04-29", root.GetProperty("start").GetString());
            Assert.Equal("2026-05-13", root.GetProperty("end").GetString());
            Assert.Equal(60, root.GetProperty("capacity").GetInt32());
            Assert.Equal(13, root.GetProperty("committedPoints").GetInt32());
            Assert.Equal(5, root.GetProperty("completedPoints").GetInt32());
            Assert.Equal(2, root.GetProperty("totalItems").GetInt32());
            Assert.Equal(1, root.GetProperty("completedItems").GetInt32());

            var burndown = root.GetProperty("burndown");
            Assert.True(burndown.TryGetProperty("ideal", out var ideal));
            Assert.True(burndown.TryGetProperty("actual", out var actual));
            Assert.NotEmpty(ideal.EnumerateArray());
            Assert.NotEmpty(actual.EnumerateArray());
        }
    }
}
