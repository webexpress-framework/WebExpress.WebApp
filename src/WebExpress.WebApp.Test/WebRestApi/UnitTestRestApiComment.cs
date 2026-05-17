using System.Collections.Generic;
using System.Text;
using System.Text.Json;
using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebRestApi;

namespace WebExpress.WebApp.Test.WebRestApi
{
    /// <summary>
    /// Provides unit tests for verifying the behavior of the
    /// <see cref="RestApiComment"/> abstract endpoint, exercised through
    /// the in-memory <see cref="TestRestApiComment"/> implementation.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestRestApiComment
    {
        /// <summary>
        /// Verifies that <c>GET</c> returns the full list of seeded comments
        /// as a flat JSON array.
        /// </summary>
        [Fact]
        public void Retrieve_ReturnsSeededComments()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var seed = new List<RestApiCommentItem>
            {
                new() { Id = "c1", Author = "u1", Body = "first",  Category = "general", When = "now", Labels = [], Likes = [], Reactions = new Dictionary<string, IEnumerable<string>>(), Replies = [] },
                new() { Id = "c2", Author = "u2", Body = "second", Category = "hint",    When = "now", Labels = [], Likes = [], Reactions = new Dictionary<string, IEnumerable<string>>(), Replies = [] }
            };
            var api = new TestRestApiComment(seed);
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
            Assert.Equal("c1", items[0].GetProperty("id").GetString());
            Assert.Equal("first", items[0].GetProperty("body").GetString());
            Assert.Equal("hint", items[1].GetProperty("category").GetString());
        }

        /// <summary>
        /// Verifies that <c>POST</c> creates a new comment from the JSON
        /// body and returns the persisted item.
        /// </summary>
        [Fact]
        public void Create_PersistsComment()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiComment();
            var request = UnitTestControlFixture.CreateRequestMock
            (
                "POST / HTTP/1.1\r\n" +
                "Host: localhost\r\n" +
                "Content-Type: application/json\r\n" +
                "\r\n" +
                "{\"body\":\"hello\",\"category\":\"question\",\"labels\":[\"a\",\"b\"]}",
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
            Assert.Equal("hello", root.GetProperty("body").GetString());
            Assert.Equal("question", root.GetProperty("category").GetString());
            Assert.Equal(2, root.GetProperty("labels").GetArrayLength());

            Assert.Single(api.Comments);
        }

        /// <summary>
        /// Verifies that <c>PUT {id}</c> updates an existing comment and
        /// marks it as edited.
        /// </summary>
        [Fact]
        public void Update_MutatesExistingComment()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var seed = new List<RestApiCommentItem>
            {
                new() { Id = "c1", Author = "u1", Body = "old", Category = "general", When = "now", Labels = [], Likes = [], Reactions = new Dictionary<string, IEnumerable<string>>(), Replies = [] }
            };
            var api = new TestRestApiComment(seed);
            var request = UnitTestControlFixture.CreateRequestMock
            (
                "PUT /c1 HTTP/1.1\r\n" +
                "Host: localhost\r\n" +
                "Content-Type: application/json\r\n" +
                "\r\n" +
                "{\"body\":\"new\",\"category\":\"decision\",\"labels\":[]}",
                "https://example.com/c1"
            );

            // act
            var result = api.Update(request);

            // validation
            Assert.NotNull(result);
            Assert.Equal(200, result.Status);

            var json = Encoding.UTF8.GetString((byte[])result.Content);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            Assert.Equal("new", root.GetProperty("body").GetString());
            Assert.Equal("decision", root.GetProperty("category").GetString());
            Assert.True(root.TryGetProperty("edited", out var edited));
            Assert.Equal("now", edited.GetProperty("when").GetString());
        }

        /// <summary>
        /// Verifies that <c>PUT</c> against a missing id yields 404.
        /// </summary>
        [Fact]
        public void Update_ReturnsNotFound_WhenIdMissing()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiComment();
            var request = UnitTestControlFixture.CreateRequestMock
            (
                "PUT /ghost HTTP/1.1\r\n" +
                "Host: localhost\r\n" +
                "Content-Type: application/json\r\n" +
                "\r\n" +
                "{\"body\":\"x\"}",
                "https://example.com/ghost"
            );

            // act
            var result = api.Update(request);

            // validation
            Assert.NotNull(result);
            Assert.Equal(404, result.Status);
        }

        /// <summary>
        /// Verifies that <c>DELETE {id}</c> returns 204 when the comment
        /// existed and removes it from the backing store.
        /// </summary>
        [Fact]
        public void Delete_RemovesExistingComment()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var seed = new List<RestApiCommentItem>
            {
                new() { Id = "c1", Author = "u1", Body = "x", Category = "general", When = "now", Labels = [], Likes = [], Reactions = new Dictionary<string, IEnumerable<string>>(), Replies = [] }
            };
            var api = new TestRestApiComment(seed);
            var request = UnitTestControlFixture.CreateRequestMock("", "https://example.com/c1");

            // act
            var result = api.Delete(request);

            // validation
            Assert.NotNull(result);
            Assert.Equal(204, result.Status);
            Assert.Empty(api.Comments);
        }

        /// <summary>
        /// Verifies that <c>POST {id}/likes</c> toggles the like for the
        /// posting user.
        /// </summary>
        [Fact]
        public void Likes_TogglesForCurrentUser()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var seed = new List<RestApiCommentItem>
            {
                new() { Id = "c1", Author = "u1", Body = "x", Category = "general", When = "now", Labels = [], Likes = [], Reactions = new Dictionary<string, IEnumerable<string>>(), Replies = [] }
            };
            var api = new TestRestApiComment(seed) { CurrentUser = "u-alice" };
            var request = UnitTestControlFixture.CreateRequestMock
            (
                "POST /c1/likes HTTP/1.1\r\n" +
                "Host: localhost\r\n" +
                "Content-Type: application/json\r\n" +
                "\r\n" +
                "{}",
                "https://example.com/c1/likes"
            );

            // act
            var result = api.Create(request);

            // validation
            Assert.Equal(200, result.Status);
            var json = Encoding.UTF8.GetString((byte[])result.Content);
            using var doc = JsonDocument.Parse(json);
            var likes = doc.RootElement.GetProperty("likes").EnumerateArray().Select(x => x.GetString()).ToList();
            Assert.Single(likes);
            Assert.Equal("u-alice", likes[0]);
        }

        /// <summary>
        /// Verifies that <c>POST {id}/pin</c> flips the pinned flag.
        /// </summary>
        [Fact]
        public void Pin_TogglesPinnedFlag()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var seed = new List<RestApiCommentItem>
            {
                new() { Id = "c1", Author = "u1", Body = "x", Category = "general", When = "now", Labels = [], Likes = [], Reactions = new Dictionary<string, IEnumerable<string>>(), Replies = [] }
            };
            var api = new TestRestApiComment(seed);
            var request = UnitTestControlFixture.CreateRequestMock
            (
                "POST /c1/pin HTTP/1.1\r\n" +
                "Host: localhost\r\n" +
                "Content-Type: application/json\r\n" +
                "\r\n",
                "https://example.com/c1/pin"
            );

            // act
            var result = api.Create(request);

            // validation
            Assert.Equal(200, result.Status);
            var json = Encoding.UTF8.GetString((byte[])result.Content);
            using var doc = JsonDocument.Parse(json);
            Assert.True(doc.RootElement.GetProperty("pinned").GetBoolean());
        }

        /// <summary>
        /// Verifies that <c>POST {id}/reactions</c> mutates the reactions
        /// map for the supplied emoji.
        /// </summary>
        [Fact]
        public void Reactions_AddEmojiForUser()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var seed = new List<RestApiCommentItem>
            {
                new() { Id = "c1", Author = "u1", Body = "x", Category = "general", When = "now", Labels = [], Likes = [], Reactions = new Dictionary<string, IEnumerable<string>>(), Replies = [] }
            };
            var api = new TestRestApiComment(seed);
            var request = UnitTestControlFixture.CreateRequestMock
            (
                "POST /c1/reactions HTTP/1.1\r\n" +
                "Host: localhost\r\n" +
                "Content-Type: application/json\r\n" +
                "\r\n" +
                "{\"emoji\":\"\\uD83D\\uDC4D\",\"userId\":\"u-bob\"}",
                "https://example.com/c1/reactions"
            );

            // act
            var result = api.Create(request);

            // validation
            Assert.Equal(200, result.Status);
            var json = Encoding.UTF8.GetString((byte[])result.Content);
            using var doc = JsonDocument.Parse(json);
            var reactions = doc.RootElement.GetProperty("reactions");
            Assert.True(reactions.TryGetProperty("👍", out var users));
            Assert.Equal("u-bob", users[0].GetString());
        }

        /// <summary>
        /// Verifies that <c>POST {id}/replies</c> appends a reply under the
        /// parent comment.
        /// </summary>
        [Fact]
        public void Replies_AppendsToParent()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var seed = new List<RestApiCommentItem>
            {
                new() { Id = "c1", Author = "u1", Body = "x", Category = "general", When = "now", Labels = [], Likes = [], Reactions = new Dictionary<string, IEnumerable<string>>(), Replies = [] }
            };
            var api = new TestRestApiComment(seed);
            var request = UnitTestControlFixture.CreateRequestMock
            (
                "POST /c1/replies HTTP/1.1\r\n" +
                "Host: localhost\r\n" +
                "Content-Type: application/json\r\n" +
                "\r\n" +
                "{\"body\":\"thanks!\"}",
                "https://example.com/c1/replies"
            );

            // act
            var result = api.Create(request);

            // validation
            Assert.Equal(200, result.Status);
            var json = Encoding.UTF8.GetString((byte[])result.Content);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            Assert.Equal("thanks!", root.GetProperty("body").GetString());
            Assert.Equal("u-test", root.GetProperty("author").GetString());
        }

        /// <summary>
        /// Verifies that unknown sub-paths surface as 404.
        /// </summary>
        [Fact]
        public void UnknownSubPath_ReturnsNotFound()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiComment();
            var request = UnitTestControlFixture.CreateRequestMock
            (
                "POST /c1/something HTTP/1.1\r\n" +
                "Host: localhost\r\n" +
                "Content-Type: application/json\r\n" +
                "\r\n" +
                "{}",
                "https://example.com/c1/something"
            );

            // act
            var result = api.Create(request);

            // validation
            Assert.Equal(404, result.Status);
        }
    }
}
