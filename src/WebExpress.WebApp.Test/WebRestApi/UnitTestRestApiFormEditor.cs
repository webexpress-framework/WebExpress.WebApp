using System.Text;
using System.Text.Json;
using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebRestApi;
using WebExpress.WebCore.WebMessage;

namespace WebExpress.WebApp.Test.WebRestApi
{
    /// <summary>
    /// Provides unit tests for the RestApiFormEditor base class: the lookup contract
    /// of the GET handler and the optimistic concurrency of the PUT handler.
    ///
    /// The editor autosaves after every change, so two open editors on the same
    /// form are the normal case. A save accepted regardless of the version it
    /// presents lets them overwrite each other silently; the conflict has to be
    /// detected where the stored version is known, which is the endpoint.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestRestApiFormEditor
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
        /// Builds a form editor API seeded with a form at version 3.
        /// </summary>
        /// <returns>The seeded API.</returns>
        private static TestRestApiFormEditor Seeded()
        {
            var api = new TestRestApiFormEditor();
            api.Seed("f1", new RestApiFormEditorItem { FormId = "f1", FormName = "Bug", Version = 3, Tabs = [] });

            return api;
        }

        /// <summary>
        /// Builds the body of a save.
        /// </summary>
        /// <param name="name">The form name.</param>
        /// <param name="version">The version the save presents.</param>
        /// <returns>The JSON body.</returns>
        private static string Body(string name, int version)
        {
            return $"{{\"formId\":\"f1\",\"formName\":\"{name}\",\"version\":{version},\"tabs\":[]}}";
        }

        /// <summary>
        /// Verifies that an unknown form is answered with 404, so the editor reports
        /// a failed load instead of opening an empty form it would then save.
        /// </summary>
        [Fact]
        public void RetrieveUnknownReturnsNotFound()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = Seeded();

            // act
            var result = api.Retrieve(Request("GET", "/form?id=missing"));

            // validation
            Assert.Equal(404, result.Status);
        }

        /// <summary>
        /// Verifies that a save presenting the stored version is applied and that the
        /// response carries the version the next save has to present.
        /// </summary>
        [Fact]
        public void UpdateWithCurrentVersion()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = Seeded();

            // act
            var result = api.Update(Request("PUT", "/form?id=f1", Body("Renamed", 3)));

            // validation
            Assert.Equal(200, result.Status);
            Assert.Single(api.Updates);

            var json = Encoding.UTF8.GetString((byte[])result.Content);
            using var doc = JsonDocument.Parse(json);
            Assert.Equal(4, doc.RootElement.GetProperty("data").GetProperty("version").GetInt32());
        }

        /// <summary>
        /// Verifies that a save presenting an outdated version is rejected with 409,
        /// names the stored version and leaves the stored form untouched.
        /// </summary>
        [Fact]
        public void UpdateWithStaleVersionReturnsConflict()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = Seeded();

            // a first editor saves and moves the version on
            api.Update(Request("PUT", "/form?id=f1", Body("First", 3)));

            // act - a second editor still holds the version it loaded
            var result = api.Update(Request("PUT", "/form?id=f1", Body("Clobbered", 3)));

            // validation
            Assert.Equal(409, result.Status);
            Assert.Single(api.Updates);

            var json = Encoding.UTF8.GetString((byte[])result.Content);
            using var doc = JsonDocument.Parse(json);
            Assert.Equal(4, doc.RootElement.GetProperty("version").GetInt32());
            Assert.False(string.IsNullOrEmpty(doc.RootElement.GetProperty("message").GetString()));
        }

        /// <summary>
        /// Verifies that the check runs against the version RetrieveVersion answers,
        /// so an endpoint serving a draft through RetrieveItem refuses a publication
        /// when the published form moved on past the version the draft started from.
        /// </summary>
        [Fact]
        public void UpdateIsCheckedAgainstRetrieveVersion()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = Seeded();
            api.PublishedVersion = 5;

            // act - the draft on screen still carries the version 3 it was started from
            var result = api.Update(Request("PUT", "/form?id=f1", Body("Draft", 3)));

            // validation
            Assert.Equal(409, result.Status);
            Assert.Empty(api.Updates);

            var json = Encoding.UTF8.GetString((byte[])result.Content);
            using var doc = JsonDocument.Parse(json);
            Assert.Equal(5, doc.RootElement.GetProperty("version").GetInt32());
        }

        /// <summary>
        /// Verifies that a form not stored yet is created whatever version the new
        /// structure carries, since there is nothing it could overwrite.
        /// </summary>
        [Fact]
        public void UpdateOfNewFormIsApplied()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiFormEditor();

            // act
            var result = api.Update(Request("PUT", "/form?id=f1", Body("New", 1)));

            // validation
            Assert.Equal(200, result.Status);
            Assert.Single(api.Updates);
        }

        /// <summary>
        /// Verifies that a client that does not version (version 0) is not rejected,
        /// so an endpoint without versioning keeps working.
        /// </summary>
        [Fact]
        public void UpdateWithoutVersionIsApplied()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = Seeded();

            // act
            var result = api.Update(Request("PUT", "/form?id=f1", Body("Unversioned", 0)));

            // validation
            Assert.Equal(200, result.Status);
        }
    }
}
