using System.Text;
using System.Text.Json;
using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebCore.WebMessage;

namespace WebExpress.WebApp.Test.WebRestApi
{
    /// <summary>
    /// Provides unit tests for the RestApiFormEditorDraft base class: the draft
    /// state of the GET handler, the revision check of the PUT handler and the
    /// DELETE handler.
    ///
    /// Draft saves do not move the version of the form, so two editors drafting
    /// one form can only be kept from overwriting each other by a revision of the
    /// draft itself, checked where the stored revision is known.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestRestApiFormEditorDraft
    {
        /// <summary>
        /// Builds a request with a method, path and optional JSON body.
        /// </summary>
        /// <param name="method">The HTTP method.</param>
        /// <param name="path">The request path including the query string.</param>
        /// <param name="body">The optional JSON body.</param>
        /// <returns>The request.</returns>
        private static IRequest Request(string method, string path, string body = null)
        {
            var content =
                $"{method} {path} HTTP/1.1\r\n" +
                "Host: localhost\r\n" +
                "Content-Type: application/json\r\n" +
                "\r\n" +
                (body ?? string.Empty);

            return UnitTestControlFixture.CreateRequestMock(content, "https://example.com" + path);
        }

        /// <summary>
        /// Builds the body of a draft save.
        /// </summary>
        /// <param name="revision">The draft revision the save presents.</param>
        /// <returns>The JSON body.</returns>
        private static string Body(int revision)
        {
            return $"{{\"formId\":\"f1\",\"formName\":\"Bug\",\"version\":3,\"draftRevision\":{revision},\"tabs\":[]}}";
        }

        /// <summary>
        /// Reads the json body of a response.
        /// </summary>
        /// <param name="response">The response.</param>
        /// <returns>The parsed document.</returns>
        private static JsonDocument Read(IResponse response)
        {
            return JsonDocument.Parse(Encoding.UTF8.GetString((byte[])response.Content));
        }

        /// <summary>
        /// Verifies that a form without a draft answers so, with revision 0.
        /// </summary>
        [Fact]
        public void RetrieveWithoutDraft()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiFormEditorDraft();

            // act
            var result = api.Retrieve(Request("GET", "/draft?id=f1"));

            // validation
            Assert.Equal(200, result.Status);
            using var doc = Read(result);
            Assert.False(doc.RootElement.GetProperty("draft").GetBoolean());
            Assert.Equal(0, doc.RootElement.GetProperty("revision").GetInt32());
        }

        /// <summary>
        /// Verifies that saves presenting the stored revision are applied one after
        /// the other and answer the revision the next save has to present.
        /// </summary>
        [Fact]
        public void UpdateWithCurrentRevision()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiFormEditorDraft();

            // act
            var first = api.Update(Request("PUT", "/draft?id=f1", Body(0)));
            var second = api.Update(Request("PUT", "/draft?id=f1", Body(1)));

            // validation
            Assert.Equal(200, first.Status);
            Assert.Equal(200, second.Status);
            Assert.Equal(2, api.Stores.Count);

            using var doc = Read(second);
            Assert.Equal(2, doc.RootElement.GetProperty("revision").GetInt32());
            Assert.True(doc.RootElement.GetProperty("draft").GetBoolean());

            using var state = Read(api.Retrieve(Request("GET", "/draft?id=f1")));
            Assert.True(state.RootElement.GetProperty("draft").GetBoolean());
            Assert.Equal(2, state.RootElement.GetProperty("revision").GetInt32());
        }

        /// <summary>
        /// Verifies that a save edited on top of an outdated revision is rejected
        /// with 409, names the stored revision and leaves the draft untouched.
        /// </summary>
        [Fact]
        public void UpdateWithStaleRevisionReturnsConflict()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiFormEditorDraft();
            api.Update(Request("PUT", "/draft?id=f1", Body(0)));
            api.Update(Request("PUT", "/draft?id=f1", Body(1)));

            // act - a second editor still holds the revision it resumed on
            var result = api.Update(Request("PUT", "/draft?id=f1", Body(1)));

            // validation
            Assert.Equal(409, result.Status);
            Assert.Equal(2, api.Stores.Count);

            using var doc = Read(result);
            Assert.Equal(2, doc.RootElement.GetProperty("revision").GetInt32());
        }

        /// <summary>
        /// Verifies that a save presenting a revision of a draft that has been
        /// published or discarded meanwhile does not re-open it unnoticed.
        /// </summary>
        [Fact]
        public void UpdateOfEndedDraftReturnsConflict()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiFormEditorDraft();
            api.Update(Request("PUT", "/draft?id=f1", Body(0)));
            api.Remove(Request("DELETE", "/draft?id=f1"));

            // act
            var result = api.Update(Request("PUT", "/draft?id=f1", Body(1)));

            // validation
            Assert.Equal(409, result.Status);
            Assert.False(api.HasDraft("f1"));

            using var doc = Read(result);
            Assert.Equal(0, doc.RootElement.GetProperty("revision").GetInt32());
        }

        /// <summary>
        /// Verifies that a store refusing a save whose revision moved on between the
        /// check and the write is answered with the same conflict.
        /// </summary>
        [Fact]
        public void UpdateRefusedByStoreReturnsConflict()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiFormEditorDraft();
            api.Update(Request("PUT", "/draft?id=f1", Body(0)));

            // another editor's save lands right after the check of this one
            api.ConcurrentWrite = _ => api.Update(Request("PUT", "/draft?id=f1", Body(1)));

            // act
            var result = api.Update(Request("PUT", "/draft?id=f1", Body(1)));

            // validation
            Assert.Equal(409, result.Status);
            Assert.Equal(2, api.Stores.Count);

            using var doc = Read(result);
            Assert.Equal(2, doc.RootElement.GetProperty("revision").GetInt32());
        }

        /// <summary>
        /// Verifies that the draft is dropped with 204.
        /// </summary>
        [Fact]
        public void Remove()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiFormEditorDraft();
            api.Update(Request("PUT", "/draft?id=f1", Body(0)));

            // act
            var result = api.Remove(Request("DELETE", "/draft?id=f1"));

            // validation
            Assert.Equal(204, result.Status);
            Assert.False(api.HasDraft("f1"));
        }

        /// <summary>
        /// Verifies that the draft revision is not written into the structure the
        /// data endpoint answers when it is zero, so that answer is unchanged.
        /// </summary>
        [Fact]
        public void DraftRevisionIsOmittedWhenZero()
        {
            // arrange
            var item = new WebExpress.WebApp.WebRestApi.RestApiFormEditorItem { FormId = "f1", Version = 3 };

            // act
            var json = JsonSerializer.Serialize(item);

            // validation
            Assert.DoesNotContain("draftRevision", json);
        }
    }
}
