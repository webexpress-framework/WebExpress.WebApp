using System.Text;
using System.Text.Json;
using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.Test.Model;
using WebExpress.WebApp.WebRestApi;

namespace WebExpress.WebApp.Test.WebRestApi
{
    /// <summary>
    /// Tests the protocol of the <see cref="RestApiAssignment{TIndexItem}"/> base, exercised
    /// through the in-memory <see cref="TestRestApiAssignment"/>: every method answers the
    /// assignment state, a missing right is <c>403</c> without a change and an unknown
    /// object is <c>404</c>.
    /// </summary>
    public class UnitTestRestApiAssignment
    {
        /// <summary>
        /// The people the test endpoints can assign.
        /// </summary>
        private static Dictionary<string, RestApiAssignmentItem> Directory() => new()
        {
            ["u1"] = new() { Id = "u1", Name = "Grace Hopper", Initials = "GH" },
            ["u2"] = new() { Id = "u2", Name = "Ada Lovelace", Image = "/img/ada.png" }
        };

        /// <summary>
        /// Builds a request with an optional json body.
        /// </summary>
        /// <param name="method">The HTTP method.</param>
        /// <param name="body">The body, or <see langword="null"/> for none.</param>
        /// <returns>The request.</returns>
        private static WebExpress.WebCore.WebMessage.IRequest Request(string method, string body = null)
        {
            if (body is null)
            {
                return UnitTestControlFixture.CreateRequestMock("", "https://example.com/");
            }

            return UnitTestControlFixture.CreateRequestMock
            (
                $"{method} / HTTP/1.1\r\n" +
                "Host: localhost\r\n" +
                "Content-Type: application/json\r\n" +
                "\r\n" +
                body,
                "https://example.com/"
            );
        }

        /// <summary>
        /// Parses the json body of a response.
        /// </summary>
        /// <param name="response">The response.</param>
        /// <returns>The parsed document.</returns>
        private static JsonDocument Parse(WebExpress.WebCore.WebMessage.IResponse response)
        {
            return JsonDocument.Parse(Encoding.UTF8.GetString((byte[])response.Content));
        }

        /// <summary>
        /// Tests that GET answers the assignee, the caller and the right to change.
        /// </summary>
        [Fact]
        public void Retrieve_ReturnsAssigneeSelfAndRight()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiAssignment(new TestIndexItem(), Directory(), selfId: "u2", assigneeId: "u1");

            // act
            var result = api.Retrieve(Request("GET"));

            // validation
            Assert.Equal(200, result.Status);
            using var doc = Parse(result);
            var root = doc.RootElement;
            Assert.Equal("u1", root.GetProperty("assignee").GetProperty("id").GetString());
            Assert.Equal("Grace Hopper", root.GetProperty("assignee").GetProperty("name").GetString());
            Assert.Equal("GH", root.GetProperty("assignee").GetProperty("initials").GetString());
            Assert.Equal("u2", root.GetProperty("self").GetProperty("id").GetString());
            Assert.Equal("/img/ada.png", root.GetProperty("self").GetProperty("image").GetString());
            Assert.True(root.GetProperty("mayChange").GetBoolean());
        }

        /// <summary>
        /// Tests that GET answers an unassigned object and an anonymous caller with nulls.
        /// </summary>
        [Fact]
        public void Retrieve_ReturnsNullsForUnassignedAndAnonymous()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiAssignment(new TestIndexItem(), Directory(), selfId: null, mayChange: false);

            // act
            var result = api.Retrieve(Request("GET"));

            // validation
            Assert.Equal(200, result.Status);
            using var doc = Parse(result);
            Assert.Equal(JsonValueKind.Null, doc.RootElement.GetProperty("assignee").ValueKind);
            Assert.Equal(JsonValueKind.Null, doc.RootElement.GetProperty("self").ValueKind);
            Assert.False(doc.RootElement.GetProperty("mayChange").GetBoolean());
        }

        /// <summary>
        /// Tests that PUT with a user id assigns that person and answers the new state.
        /// </summary>
        [Fact]
        public void Update_WithUserId_AssignsThatPerson()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiAssignment(new TestIndexItem(), Directory(), selfId: "u2");

            // act
            var result = api.Update(Request("PUT", "{\"userId\":\"u1\"}"));

            // validation
            Assert.Equal(200, result.Status);
            Assert.Equal("u1", api.AssigneeId);
            using var doc = Parse(result);
            Assert.Equal("u1", doc.RootElement.GetProperty("assignee").GetProperty("id").GetString());
            Assert.Equal("u2", doc.RootElement.GetProperty("self").GetProperty("id").GetString());
        }

        /// <summary>
        /// Tests that PUT without a user id assigns the caller, whether the body is empty
        /// json or missing altogether.
        /// </summary>
        /// <param name="body">The request body.</param>
        [Theory]
        [InlineData("{}")]
        [InlineData(null)]
        public void Update_WithoutUserId_AssignsTheCaller(string body)
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiAssignment(new TestIndexItem(), Directory(), selfId: "u2", assigneeId: "u1");

            // act
            var result = api.Update(Request("PUT", body));

            // validation
            Assert.Equal(200, result.Status);
            Assert.Equal("u2", api.AssigneeId);
            using var doc = Parse(result);
            Assert.Equal("u2", doc.RootElement.GetProperty("assignee").GetProperty("id").GetString());
        }

        /// <summary>
        /// Tests that an anonymous caller cannot assign the object to themselves.
        /// </summary>
        [Fact]
        public void Update_WithoutUserIdForAnonymousCaller_IsForbidden()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiAssignment(new TestIndexItem(), Directory(), selfId: null);

            // act
            var result = api.Update(Request("PUT", "{}"));

            // validation
            Assert.Equal(403, result.Status);
            Assert.Null(api.AssigneeId);
        }

        /// <summary>
        /// Tests that PUT for a person nobody knows is a bad request and changes nothing.
        /// </summary>
        [Fact]
        public void Update_WithUnknownUser_IsBadRequest()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiAssignment(new TestIndexItem(), Directory(), selfId: "u2", assigneeId: "u1");

            // act
            var result = api.Update(Request("PUT", "{\"userId\":\"ghost\"}"));

            // validation
            Assert.Equal(400, result.Status);
            Assert.Equal("u1", api.AssigneeId);
        }

        /// <summary>
        /// Tests that a body that is not json is a bad request.
        /// </summary>
        [Fact]
        public void Update_WithInvalidBody_IsBadRequest()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiAssignment(new TestIndexItem(), Directory(), selfId: "u2");

            // act
            var result = api.Update(Request("PUT", "not json"));

            // validation
            Assert.Equal(400, result.Status);
            Assert.Null(api.AssigneeId);
        }

        /// <summary>
        /// Tests that DELETE removes the assignment and answers the new state.
        /// </summary>
        [Fact]
        public void Delete_RemovesTheAssignment()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiAssignment(new TestIndexItem(), Directory(), selfId: "u1", assigneeId: "u1");

            // act
            var result = api.Delete(Request("DELETE"));

            // validation
            Assert.Equal(200, result.Status);
            Assert.Null(api.AssigneeId);
            using var doc = Parse(result);
            Assert.Equal(JsonValueKind.Null, doc.RootElement.GetProperty("assignee").ValueKind);
            Assert.Equal("u1", doc.RootElement.GetProperty("self").GetProperty("id").GetString());
        }

        /// <summary>
        /// Tests that a caller without the right gets 403 on every write and the assignment
        /// stays as it was.
        /// </summary>
        [Fact]
        public void Writes_WithoutRight_AreForbiddenAndChangeNothing()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiAssignment(new TestIndexItem(), Directory(), selfId: "u2", assigneeId: "u1", mayChange: false);

            // act
            var put = api.Update(Request("PUT", "{}"));
            var delete = api.Delete(Request("DELETE"));

            // validation
            Assert.Equal(403, put.Status);
            Assert.Equal(403, delete.Status);
            Assert.Equal("u1", api.AssigneeId);
        }

        /// <summary>
        /// Tests that every method answers 404 for an object that does not exist.
        /// </summary>
        [Fact]
        public void UnknownObject_IsNotFound()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiAssignment(null, Directory(), selfId: "u1");

            // act & validation
            Assert.Equal(404, api.Retrieve(Request("GET")).Status);
            Assert.Equal(404, api.Update(Request("PUT", "{}")).Status);
            Assert.Equal(404, api.Delete(Request("DELETE")).Status);
        }

        /// <summary>
        /// Tests that a refusal reaches the caller with its reason as json and leaves the
        /// assignment untouched.
        /// </summary>
        [Fact]
        public void Refusal_AnswersTheReasonAndChangesNothing()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiAssignment(new TestIndexItem(), Directory(), selfId: "u2", assigneeId: "u1")
            {
                Refusal = "The object is locked."
            };

            // act
            var put = api.Update(Request("PUT", "{}"));
            var delete = api.Delete(Request("DELETE"));

            // validation
            Assert.Equal(400, put.Status);
            Assert.Equal(400, delete.Status);
            Assert.Equal("u1", api.AssigneeId);
            using var doc = Parse(put);
            Assert.Equal("The object is locked.", doc.RootElement.GetProperty("message").GetString());
        }
    }
}
