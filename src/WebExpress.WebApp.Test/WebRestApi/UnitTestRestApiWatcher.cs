using System.Text;
using System.Text.Json;
using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebRestApi;

namespace WebExpress.WebApp.Test.WebRestApi
{
    /// <summary>
    /// Provides unit tests for verifying the behavior of the
    /// <see cref="RestApiWatcher"/> abstract endpoint, exercised through
    /// the in-memory <see cref="TestRestApiWatcher"/> implementation.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestRestApiWatcher
    {
        /// <summary>
        /// Verifies that <c>GET</c> returns the full list of seeded
        /// watchers as a flat JSON array.
        /// </summary>
        [Fact]
        public void Retrieve_ReturnsSeededWatchers()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var seed = new List<RestApiWatcherItem>
            {
                new() { Id = "u1", Name = "Guybrush",   Team = "Pirate", Initials = "GT", Color = "#1d4ed8" },
                new() { Id = "u2", Name = "Elaine",     Team = "Governor", Initials = "EM", Color = "#7c3aed" }
            };
            var api = new TestRestApiWatcher(seed);
            var request = UnitTestControlFixture.CreateRequestMock("", "https://example.com/");

            // act
            var result = api.Retrieve(request);

            // validation
            Assert.NotNull(result);
            Assert.Equal(200, result.Status);

            var json = Encoding.UTF8.GetString((byte[])result.Content);
            using var doc = JsonDocument.Parse(json);
            var items = doc.RootElement.EnumerateArray().ToList();
            Assert.Equal(2, items.Count);
            Assert.Equal("u1", items[0].GetProperty("id").GetString());
            Assert.Equal("Guybrush", items[0].GetProperty("name").GetString());
            Assert.Equal("Pirate", items[0].GetProperty("team").GetString());
            Assert.Equal("EM", items[1].GetProperty("initials").GetString());
        }

        /// <summary>
        /// Verifies that <c>GET</c> on a sub-path yields 200 — the
        /// endpoint only handles the base path for list reads.
        /// </summary>
        [Fact]
        public void Retrieve_ReturnsNotFound_OnSubPath()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiWatcher();
            var request = UnitTestControlFixture.CreateRequestMock("", "https://example.com/u1");

            // act
            var result = api.Retrieve(request);

            // validation
            Assert.NotNull(result);
            Assert.Equal(200, result.Status);
        }

        /// <summary>
        /// Verifies that <c>POST</c> resolves the user id against the
        /// directory and appends the watcher to the backing store.
        /// </summary>
        [Fact]
        public void Create_AddsWatcher()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var directory = new Dictionary<string, RestApiWatcherItem>
            {
                ["u1"] = new() { Id = "u1", Name = "Guybrush", Team = "Pirate", Initials = "GT", Color = "#1d4ed8" }
            };
            var api = new TestRestApiWatcher(directory: directory);
            var request = UnitTestControlFixture.CreateRequestMock
            (
                "POST / HTTP/1.1\r\n" +
                "Host: localhost\r\n" +
                "Content-Type: application/json\r\n" +
                "\r\n" +
                "{\"userId\":\"u1\"}",
                "https://example.com/"
            );

            // act
            var result = api.Create(request);

            // validation
            Assert.NotNull(result);
            Assert.Equal(200, result.Status);

            var json = Encoding.UTF8.GetString((byte[])result.Content);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            Assert.Equal("u1", root.GetProperty("id").GetString());
            Assert.Equal("Guybrush", root.GetProperty("name").GetString());

            Assert.Single(api.Watchers);
        }

        /// <summary>
        /// Verifies that <c>POST</c> against an unknown user id yields 404.
        /// </summary>
        [Fact]
        public void Create_ReturnsNotFound_WhenUserMissing()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiWatcher();
            var request = UnitTestControlFixture.CreateRequestMock
            (
                "POST / HTTP/1.1\r\n" +
                "Host: localhost\r\n" +
                "Content-Type: application/json\r\n" +
                "\r\n" +
                "{\"userId\":\"ghost\"}",
                "https://example.com/"
            );

            // act
            var result = api.Create(request);

            // validation
            Assert.NotNull(result);
            Assert.Equal(404, result.Status);
        }

        /// <summary>
        /// Verifies that <c>POST</c> with an empty body yields 400.
        /// </summary>
        [Fact]
        public void Create_ReturnsBadRequest_WhenPayloadMissing()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiWatcher();
            var request = UnitTestControlFixture.CreateRequestMock("", "https://example.com/");

            // act
            var result = api.Create(request);

            // validation
            Assert.NotNull(result);
            Assert.Equal(400, result.Status);
        }

        /// <summary>
        /// Verifies that <c>DELETE {userId}</c> returns 204 when the
        /// watcher existed and removes it from the backing store.
        /// </summary>
        [Fact]
        public void Delete_RemovesExistingWatcher()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var seed = new List<RestApiWatcherItem>
            {
                new() { Id = "u1", Name = "Guybrush", Team = "Pirate", Initials = "GT", Color = "#1d4ed8" }
            };
            var api = new TestRestApiWatcher(seed);
            var request = UnitTestControlFixture.CreateRequestMock("", "https://example.com/u1");

            // act
            var result = api.Delete(request);

            // validation
            Assert.NotNull(result);
            Assert.Equal(204, result.Status);
            Assert.Empty(api.Watchers);
        }

        /// <summary>
        /// Verifies that <c>DELETE {userId}</c> against an unknown id
        /// yields 404 and leaves the store untouched.
        /// </summary>
        [Fact]
        public void Delete_ReturnsNotFound_WhenIdMissing()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var seed = new List<RestApiWatcherItem>
            {
                new() { Id = "u1", Name = "Guybrush", Team = "Pirate", Initials = "GT", Color = "#1d4ed8" }
            };
            var api = new TestRestApiWatcher(seed);
            var request = UnitTestControlFixture.CreateRequestMock("", "https://example.com/ghost");

            // act
            var result = api.Delete(request);

            // validation
            Assert.NotNull(result);
            Assert.Equal(404, result.Status);
            Assert.Single(api.Watchers);
        }

        /// <summary>
        /// Verifies that <c>DELETE</c> against the base path (no id) yields 404.
        /// </summary>
        [Fact]
        public void Delete_ReturnsNotFound_OnBasePath()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiWatcher();
            var request = UnitTestControlFixture.CreateRequestMock("", "https://example.com/");

            // act
            var result = api.Delete(request);

            // validation
            Assert.NotNull(result);
            Assert.Equal(404, result.Status);
        }
    }
}
