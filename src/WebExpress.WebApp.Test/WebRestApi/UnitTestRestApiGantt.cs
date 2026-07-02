using System.Text;
using System.Text.Json;
using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebRestApi;
using WebExpress.WebCore.WebMessage;

namespace WebExpress.WebApp.Test.WebRestApi
{
    /// <summary>
    /// Provides unit tests for verifying the behavior of the RestApiGantt class,
    /// namely the GET project load and the sub-path routing of the task and link
    /// mutations.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestRestApiGantt
    {
        /// <summary>
        /// Builds a request with a method, path and optional JSON body. The URI
        /// carries the path so the base class can route on the trailing
        /// segments.
        /// </summary>
        /// <param name="method">The HTTP method.</param>
        /// <param name="path">The request path, for example /gantt/tasks/t1.</param>
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
        /// Builds a gantt API seeded with a container, its two children, a
        /// standalone task and two links onto the standalone task.
        /// </summary>
        /// <returns>The seeded API.</returns>
        private static TestRestApiGantt Seeded()
        {
            var api = new TestRestApiGantt();
            api.Seed
            (
                [
                    new RestApiGanttTask { Id = "p1", Label = "Phase" },
                    new RestApiGanttTask { Id = "t1", Label = "A", ParentId = "p1", Start = "2026-07-06", Duration = 2 },
                    new RestApiGanttTask { Id = "t2", Label = "B", ParentId = "p1", Start = "2026-07-08", Duration = 2 },
                    new RestApiGanttTask { Id = "t3", Label = "C", Start = "2026-07-10", Duration = 3 }
                ],
                [
                    new RestApiGanttLink { Id = "l1", From = "t1", To = "t3", Type = "FS" },
                    new RestApiGanttLink { Id = "l2", From = "t2", To = "t3", Type = "SS" }
                ]
            );

            return api;
        }

        /// <summary>
        /// Tests that the title is set correctly on construction.
        /// </summary>
        [Fact]
        public void SetTitle()
        {
            // act
            var api = new TestRestApiGantt("my plan");

            // validation
            Assert.Equal("my plan", api.Title);
        }

        /// <summary>
        /// Verifies that the GET request returns the whole project as tasks and
        /// links.
        /// </summary>
        [Fact]
        public void Retrieve()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = Seeded();
            var request = Request("GET", "/gantt");

            // act
            var result = api.Retrieve(request);

            // validation
            Assert.NotNull(result);
            Assert.Equal(200, result.Status);

            var json = Encoding.UTF8.GetString((byte[])result.Content);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            var tasks = root.GetProperty("tasks").EnumerateArray().ToList();
            Assert.Equal(4, tasks.Count);
            Assert.Equal("p1", tasks[0].GetProperty("id").GetString());

            var links = root.GetProperty("links").EnumerateArray().ToList();
            Assert.Equal(2, links.Count);
            Assert.Equal("SS", links[1].GetProperty("type").GetString());
        }

        /// <summary>
        /// Verifies that a POST to /tasks stores the task and echoes back the
        /// server assigned id.
        /// </summary>
        [Fact]
        public void CreateTask()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = Seeded();
            var request = Request("POST", "/gantt/tasks", "{\"label\":\"New\",\"start\":\"2026-07-20\",\"duration\":2,\"resources\":[\"Anna\"]}");

            // act
            var result = api.Create(request);

            // validation
            Assert.Equal(200, result.Status);
            Assert.Equal(5, api.Tasks.Count);

            var created = api.Tasks.Last();
            Assert.Equal("New", created.Label);
            Assert.Equal("srv-t5", created.Id);
            Assert.Equal(new[] { "Anna" }, created.Resources);

            var json = Encoding.UTF8.GetString((byte[])result.Content);
            using var doc = JsonDocument.Parse(json);
            Assert.Equal("srv-t5", doc.RootElement.GetProperty("id").GetString());
        }

        /// <summary>
        /// Verifies that a POST to /links stores the dependency.
        /// </summary>
        [Fact]
        public void CreateLink()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = Seeded();
            var request = Request("POST", "/gantt/links", "{\"from\":\"t1\",\"to\":\"t2\",\"type\":\"SS\"}");

            // act
            var result = api.Create(request);

            // validation
            Assert.Equal(200, result.Status);
            Assert.Equal(3, api.Links.Count);

            var created = api.Links.Last();
            Assert.Equal("t1", created.From);
            Assert.Equal("t2", created.To);
            Assert.Equal("SS", created.Type);
        }

        /// <summary>
        /// Verifies that a PUT to /tasks/{id} applies the change to the stored
        /// task.
        /// </summary>
        [Fact]
        public void UpdateTask()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = Seeded();
            var request = Request("PUT", "/gantt/tasks/t3", "{\"id\":\"t3\",\"label\":\"C+\",\"start\":\"2026-07-10\",\"end\":\"2026-07-15\",\"duration\":5,\"progress\":40}");

            // act
            var result = api.Update(request);

            // validation
            Assert.Equal(200, result.Status);

            var task = api.Tasks.Single(x => x.Id == "t3");
            Assert.Equal("C+", task.Label);
            Assert.Equal(5, task.Duration);
            Assert.Equal(40, task.Progress);
        }

        /// <summary>
        /// Verifies that a PUT for an unknown task id returns 404.
        /// </summary>
        [Fact]
        public void UpdateUnknownTaskReturnsNotFound()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = Seeded();
            var request = Request("PUT", "/gantt/tasks/none", "{\"id\":\"none\",\"label\":\"X\"}");

            // act
            var result = api.Update(request);

            // validation
            Assert.Equal(404, result.Status);
        }

        /// <summary>
        /// Verifies that a DELETE of a container cascades over its subtree and
        /// removes every link that touches a removed task.
        /// </summary>
        [Fact]
        public void DeleteTaskCascades()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = Seeded();
            var request = Request("DELETE", "/gantt/tasks/p1");

            // act
            var result = api.Delete(request);

            // validation
            Assert.Equal(204, result.Status);
            Assert.Equal(new[] { "t3" }, api.Tasks.Select(x => x.Id).ToArray());
            Assert.Empty(api.Links);
        }

        /// <summary>
        /// Verifies that a DELETE of a link removes only that link.
        /// </summary>
        [Fact]
        public void DeleteLink()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = Seeded();
            var request = Request("DELETE", "/gantt/links/l1");

            // act
            var result = api.Delete(request);

            // validation
            Assert.Equal(204, result.Status);
            Assert.Equal(new[] { "l2" }, api.Links.Select(x => x.Id).ToArray());
            Assert.Equal(4, api.Tasks.Count);
        }

        /// <summary>
        /// Verifies that a DELETE of an unknown link returns 404.
        /// </summary>
        [Fact]
        public void DeleteUnknownLinkReturnsNotFound()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = Seeded();
            var request = Request("DELETE", "/gantt/links/none");

            // act
            var result = api.Delete(request);

            // validation
            Assert.Equal(404, result.Status);
        }

        /// <summary>
        /// Verifies that a POST to an unknown collection returns 404.
        /// </summary>
        [Fact]
        public void UnknownCollectionReturnsNotFound()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = Seeded();
            var request = Request("POST", "/gantt/bogus", "{}");

            // act
            var result = api.Create(request);

            // validation
            Assert.Equal(404, result.Status);
        }
    }
}
