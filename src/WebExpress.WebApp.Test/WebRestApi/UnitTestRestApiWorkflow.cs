using System.Text;
using System.Text.Json;
using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebRestApi;
using WebExpress.WebCore.WebMessage;

namespace WebExpress.WebApp.Test.WebRestApi
{
    /// <summary>
    /// Provides unit tests for the RestApiWorkflow base class: the lookup contract
    /// of the GET handler and the optimistic concurrency of the PUT handler.
    ///
    /// Both matter to the editor. A miss answered with 200 and an empty body is
    /// indistinguishable from an empty workflow, so the editor renders a blank
    /// canvas and no one learns why. A save accepted regardless of the version it
    /// presents lets two open editors overwrite each other silently, which is the
    /// normal case for a control that autosaves after every drag.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestRestApiWorkflow
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
        /// Builds a workflow API seeded with a two-state workflow at revision 1.
        /// </summary>
        /// <returns>The seeded API.</returns>
        private static TestRestApiWorkflow Seeded()
        {
            var api = new TestRestApiWorkflow();
            api.Seed
            (
                new RestApiWorkflowResult { Id = "wf1", Name = "Approval", Version = "1" },
                [
                    new RestApiWorkflowState { Id = "draft", Label = "Draft", IsStart = true, Icon = "fas fa-pen" },
                    new RestApiWorkflowState { Id = "done", Label = "Done", IsEnd = true, Image = "/assets/done.png" }
                ],
                [
                    new RestApiWorkflowTransition { Id = "t1", From = "draft", To = "done", Label = "approve" }
                ]
            );

            return api;
        }

        /// <summary>
        /// Verifies that a known workflow is returned with its states and transitions.
        /// </summary>
        [Fact]
        public void Retrieve()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = Seeded();
            var request = Request("GET", "/workflow?id=wf1");

            // act
            var result = api.Retrieve(request);

            // validation
            Assert.Equal(200, result.Status);

            var json = Encoding.UTF8.GetString((byte[])result.Content);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            Assert.Equal("wf1", root.GetProperty("id").GetString());
            Assert.Equal("Approval", root.GetProperty("name").GetString());
            Assert.Equal("1", root.GetProperty("version").GetString());
            Assert.Equal(2, root.GetProperty("states").GetArrayLength());
            Assert.Equal(1, root.GetProperty("transitions").GetArrayLength());
        }

        /// <summary>
        /// Verifies that the state carries the image URL and the start and end
        /// markers, which the editor needs to render picture symbols and to reason
        /// about reachability.
        /// </summary>
        [Fact]
        public void RetrieveCarriesImageAndStateMarkers()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = Seeded();
            var request = Request("GET", "/workflow?id=wf1");

            // act
            var result = api.Retrieve(request);

            // validation
            var json = Encoding.UTF8.GetString((byte[])result.Content);
            using var doc = JsonDocument.Parse(json);
            var states = doc.RootElement.GetProperty("states").EnumerateArray().ToList();

            Assert.Equal("fas fa-pen", states[0].GetProperty("icon").GetString());
            Assert.True(states[0].GetProperty("isStart").GetBoolean());
            Assert.False(states[0].GetProperty("isEnd").GetBoolean());

            Assert.Equal("/assets/done.png", states[1].GetProperty("image").GetString());
            Assert.True(states[1].GetProperty("isEnd").GetBoolean());
        }

        /// <summary>
        /// Verifies that an unknown workflow is answered with 404 rather than with
        /// an empty 200 body.
        /// </summary>
        [Fact]
        public void RetrieveUnknownReturnsNotFound()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = Seeded();
            var request = Request("GET", "/workflow?id=missing");

            // act
            var result = api.Retrieve(request);

            // validation
            Assert.Equal(404, result.Status);
        }

        /// <summary>
        /// Verifies that a missing id is still rejected as a bad request, which is
        /// a different fault from an id that simply does not resolve.
        /// </summary>
        [Fact]
        public void RetrieveWithoutIdReturnsBadRequest()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = Seeded();
            var request = Request("GET", "/workflow");

            // act
            var result = api.Retrieve(request);

            // validation
            Assert.Equal(400, result.Status);
        }

        /// <summary>
        /// Verifies that a save presenting the current version is applied and that
        /// the response carries the revision the next save has to present.
        /// </summary>
        [Fact]
        public void UpdateWithCurrentVersion()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = Seeded();
            var request = Request("PUT", "/workflow?id=wf1", "{\"id\":\"wf1\",\"name\":\"Renamed\",\"version\":\"1\",\"states\":[],\"transitions\":[]}");

            // act
            var result = api.Update(request);

            // validation
            Assert.Equal(200, result.Status);
            Assert.Single(api.Updates);
            Assert.Equal("Renamed", api.Updates[0].Name);

            var json = Encoding.UTF8.GetString((byte[])result.Content);
            using var doc = JsonDocument.Parse(json);
            Assert.True(doc.RootElement.GetProperty("success").GetBoolean());
            Assert.Equal("2", doc.RootElement.GetProperty("version").GetString());
        }

        /// <summary>
        /// Verifies that a save presenting a stale version is rejected with 409 and
        /// leaves the stored workflow untouched.
        /// </summary>
        [Fact]
        public void UpdateWithStaleVersionReturnsConflict()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = Seeded();

            // a first editor saves and moves the revision on
            api.Update(Request("PUT", "/workflow?id=wf1", "{\"id\":\"wf1\",\"version\":\"1\",\"states\":[],\"transitions\":[]}"));

            // act - a second editor still holds the revision it loaded
            var result = api.Update(Request("PUT", "/workflow?id=wf1", "{\"id\":\"wf1\",\"name\":\"Clobbered\",\"version\":\"1\",\"states\":[],\"transitions\":[]}"));

            // validation
            Assert.Equal(409, result.Status);
            Assert.Single(api.Updates);
            Assert.DoesNotContain(api.Updates, u => u.Name == "Clobbered");
        }

        /// <summary>
        /// Verifies that a source which does not version its workflows keeps
        /// working: with no version on either side there is nothing to compare and
        /// the save goes through.
        /// </summary>
        [Fact]
        public void UpdateWithoutVersioningIsAccepted()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiWorkflow();
            api.Seed(new RestApiWorkflowResult { Id = "wf1", Name = "Unversioned" });
            var request = Request("PUT", "/workflow?id=wf1", "{\"id\":\"wf1\",\"name\":\"Renamed\",\"states\":[],\"transitions\":[]}");

            // act
            var result = api.Update(request);

            // validation
            Assert.Equal(200, result.Status);
            Assert.Single(api.Updates);
        }

        /// <summary>
        /// Verifies that saving an unknown workflow is a 404 rather than a silent
        /// success on a workflow that does not exist.
        /// </summary>
        [Fact]
        public void UpdateUnknownReturnsNotFound()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = Seeded();
            var request = Request("PUT", "/workflow?id=missing", "{\"id\":\"missing\",\"states\":[],\"transitions\":[]}");

            // act
            var result = api.Update(request);

            // validation
            Assert.Equal(404, result.Status);
            Assert.Empty(api.Updates);
        }

        /// <summary>
        /// Verifies that a save carrying fractional coordinates is accepted.
        ///
        /// The editor works in continuous canvas space: a dragged state, a node
        /// whose size is derived from a circle diameter, or a moved waypoint all
        /// produce fractional pixel positions. The DTO models a position as a whole
        /// number, and a strict deserializer rejects the whole payload over it - so
        /// every save after the first drag failed, and the workflow silently stopped
        /// persisting.
        /// </summary>
        [Fact]
        public void UpdateAcceptsFractionalCoordinates()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = Seeded();
            var request = Request("PUT", "/workflow?id=wf1",
                "{\"id\":\"wf1\",\"version\":\"1\"," +
                "\"states\":[{\"id\":\"draft\",\"label\":\"Draft\",\"x\":40.5,\"y\":119.6}]," +
                "\"transitions\":[{\"id\":\"t1\",\"from\":\"draft\",\"to\":\"draft\",\"waypoints\":[{\"x\":12.4,\"y\":-7.5}]}]}");

            // act
            var result = api.Update(request);

            // validation
            Assert.Equal(200, result.Status);
            Assert.Single(api.Updates);

            var state = api.Updates[0].States.First();
            Assert.Equal(41, state.X);
            Assert.Equal(120, state.Y);

            var waypoint = api.Updates[0].Transitions.First().Waypoints[0];
            Assert.Equal(12, waypoint.X);
            Assert.Equal(-8, waypoint.Y);
        }

        /// <summary>
        /// Verifies that a save without a body is rejected as a bad request.
        /// </summary>
        [Fact]
        public void UpdateWithoutBodyReturnsBadRequest()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = Seeded();
            var request = Request("PUT", "/workflow?id=wf1");

            // act
            var result = api.Update(request);

            // validation
            Assert.Equal(400, result.Status);
        }

        /// <summary>
        /// Verifies that the default implementation still answers a lookup, so a
        /// read-only source that overrides nothing keeps working.
        /// </summary>
        [Fact]
        public void RetrieveOnDefaultImplementation()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new DefaultRestApiWorkflow();
            var request = Request("GET", "/workflow?id=any");

            // act
            var result = api.Retrieve(request);

            // validation
            Assert.Equal(200, result.Status);
        }

        /// <summary>
        /// A workflow API that overrides nothing, standing in for a consumer that
        /// only fills in the retrieval hooks later.
        /// </summary>
        private class DefaultRestApiWorkflow : RestApiWorkflow
        {
        }
    }
}
