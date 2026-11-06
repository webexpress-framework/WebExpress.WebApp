using System.Text;
using System.Text.Json;
using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.Test.Model;
using WebExpress.WebApp.WebControl;
using WebExpress.WebApp.WebRestApi;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebIndex.Queries;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebRestApi
{
    /// <summary>
    /// Tests the REST base of the data tree and the control that renders its host.
    /// </summary>
    public class UnitTestRestApiTree
    {
        /// <summary>
        /// Tests that the root level and the level of a node are answered as node arrays.
        /// </summary>
        /// <param name="uri">The requested address.</param>
        /// <param name="expected">The expected ids, comma separated.</param>
        [Theory]
        [InlineData("/tree", "a,b")]
        [InlineData("/tree?node=a", "a1,a2")]
        [InlineData("/tree?node=b", "")]
        public void Level(string uri, string expected)
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestTree();

            // act
            var json = Read(api.Retrieve(Request("GET", uri)));

            // validation
            Assert.Equal(expected, string.Join(",", json.EnumerateArray().Select(x => x.GetProperty("id").GetString())));
        }

        /// <summary>
        /// Tests that a node answers with the fields the client reads.
        /// </summary>
        [Fact]
        public void NodeShape()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestTree();

            // act
            var a = Read(api.Retrieve(Request("GET", "/tree")))[0];

            // validation
            Assert.Equal("A", a.GetProperty("label").GetString());
            Assert.True(a.GetProperty("hasChildren").GetBoolean());
            Assert.True(a.GetProperty("droppable").GetBoolean());
            Assert.Equal("/pages/a", a.GetProperty("uri").GetString());
        }

        /// <summary>
        /// Tests that a reveal answers the path from the root and every level on it.
        /// </summary>
        [Fact]
        public void Reveal()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestTree();

            // act
            var json = Read(api.Retrieve(Request("GET", "/tree?reveal=a11")));

            // validation
            Assert.Equal(["a", "a1", "a11"], json.GetProperty("path").EnumerateArray().Select(x => x.GetString()));
            var levels = json.GetProperty("levels");
            Assert.Equal(["", "a", "a1"], levels.EnumerateObject().Select(x => x.Name));
            Assert.Equal("a11", levels.GetProperty("a1")[0].GetProperty("id").GetString());
        }

        /// <summary>
        /// Tests that an unknown node cannot be revealed.
        /// </summary>
        [Fact]
        public void RevealUnknown()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestTree();

            // act
            var response = api.Retrieve(Request("GET", "/tree?reveal=zz"));

            // validation
            Assert.Equal(404, response.Status);
        }

        /// <summary>
        /// Tests that a move reaches the hook, and that a move into the own subtree or a malformed
        /// one is refused before it.
        /// </summary>
        /// <param name="body">The body of the move.</param>
        /// <param name="status">The expected status.</param>
        /// <param name="moved">The move the hook is expected to receive, or null for none.</param>
        [Theory]
        [InlineData("{\"node\":\"b\",\"target\":\"a1\",\"position\":\"child\"}", 200, "b>a1:Child")]
        [InlineData("{\"node\":\"a2\",\"target\":\"b\",\"position\":\"above\"}", 200, "a2>b:Above")]
        [InlineData("{\"node\":\"a\",\"target\":\"a11\",\"position\":\"child\"}", 400, null)]
        [InlineData("{\"node\":\"a\",\"target\":\"a11\",\"position\":\"below\"}", 400, null)]
        [InlineData("{\"node\":\"a\",\"target\":\"b\",\"position\":\"sideways\"}", 400, null)]
        [InlineData("{\"node\":\"a2\",\"target\":\"b\",\"position\":\"99\"}", 400, null)]
        [InlineData("{\"node\":\"a2\",\"target\":\"b\",\"position\":\"2\"}", 400, null)]
        [InlineData("{\"node\":\"a2\",\"target\":\"b\",\"position\":\"BELOW\"}", 200, "a2>b:Below")]
        [InlineData("{\"node\":\"a\",\"target\":\"a\",\"position\":\"child\"}", 400, null)]
        [InlineData("not json", 400, null)]
        public void Move(string body, int status, string moved)
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestTree();

            // act
            var response = api.Update(Request("PUT", "/tree", body));

            // validation
            Assert.Equal(status, response.Status);
            Assert.Equal(moved, api.Moved);
        }

        /// <summary>
        /// Tests that a tree that does not override the move refuses it.
        /// </summary>
        [Fact]
        public void MoveRefusedByDefault()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestTree() { Refuse = true };

            // act
            var response = api.Update(Request("PUT", "/tree", "{\"node\":\"b\",\"target\":\"a\",\"position\":\"child\"}"));

            // validation
            Assert.Equal(400, response.Status);
        }

        /// <summary>
        /// Tests the host the control renders for the client.
        /// </summary>
        [Fact]
        public void Control()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataTree("pages")
            {
                Movable = _ => true,
                Selected = _ => "a11",
                Expanded = _ => ["a", "a1"]
            }
                .DataService<TestRestApiTable>();

            // act
            var html = control.Render(context, visualTree).ToString();

            // validation
            Assert.Contains("class=\"wx-webapp-tree\"", html);
            Assert.Contains("data-movable=\"true\"", html);
            Assert.Contains("data-selected=\"a11\"", html);
            Assert.Contains("data-expanded=\"[&quot;a&quot;,&quot;a1&quot;]\"", html);
            Assert.Contains("<wx-service hidden name=\"data\"", html);
            Assert.Contains("update-method=\"PUT\"", html);
        }

        /// <summary>
        /// Builds a request.
        /// </summary>
        /// <param name="method">The http method.</param>
        /// <param name="path">The path and query.</param>
        /// <param name="body">The json body, or null.</param>
        /// <returns>The request.</returns>
        private static IRequest Request(string method, string path, string body = null)
        {
            var content = $"{method} {path} HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\n\r\n{body}";

            return UnitTestControlFixture.CreateRequestMock(content, "https://example.com" + path);
        }

        /// <summary>
        /// Reads a json answer.
        /// </summary>
        /// <param name="response">The response.</param>
        /// <returns>The parsed json.</returns>
        private static JsonElement Read(IResponse response)
        {
            Assert.Equal(200, response.Status);

            return JsonDocument.Parse(Encoding.UTF8.GetString((byte[])response.Content)).RootElement.Clone();
        }

        /// <summary>
        /// A tree over a fixed hierarchy that records its moves.
        /// </summary>
        private sealed class TestTree : RestApiTree<TestIndexItem>
        {
            private static readonly Dictionary<string, string[]> _children = new()
            {
                [""] = ["a", "b"],
                ["a"] = ["a1", "a2"],
                ["a1"] = ["a11"]
            };

            /// <summary>
            /// Gets or sets whether the tree keeps the default refusal of moves.
            /// </summary>
            public bool Refuse { get; set; }

            /// <summary>
            /// Gets the move the hook received, as node&gt;target:position.
            /// </summary>
            public string Moved { get; private set; }

            /// <summary>
            /// Returns the children of a node.
            /// </summary>
            /// <param name="parentId">The parent, or null for the root.</param>
            /// <param name="context">The query context.</param>
            /// <param name="request">The request.</param>
            /// <returns>The children.</returns>
            protected override IEnumerable<RestApiTreeNode> RetrieveChildren(string parentId, IQueryContext context, IRequest request)
            {
                return (_children.TryGetValue(parentId ?? "", out var ids) ? ids : []).Select(id => new RestApiTreeNode
                {
                    Id = id,
                    Label = id.ToUpperInvariant(),
                    Uri = "/pages/" + id,
                    HasChildren = _children.ContainsKey(id)
                });
            }

            /// <summary>
            /// Returns the parent of a node.
            /// </summary>
            /// <param name="id">The node.</param>
            /// <param name="context">The query context.</param>
            /// <param name="request">The request.</param>
            /// <returns>The parent, or null for a root node.</returns>
            protected override string RetrieveParent(string id, IQueryContext context, IRequest request)
            {
                var parent = _children.FirstOrDefault(x => x.Value.Contains(id)).Key;

                return string.IsNullOrEmpty(parent) ? null : parent;
            }

            /// <summary>
            /// Records the move.
            /// </summary>
            /// <param name="node">The moved node.</param>
            /// <param name="target">The node it was dropped on.</param>
            /// <param name="position">The position relative to the target.</param>
            /// <param name="context">The query context.</param>
            /// <param name="request">The request.</param>
            /// <returns>True when the move is taken.</returns>
            protected override bool MoveNode(string node, string target, RestApiTreeMovePosition position, IQueryContext context, IRequest request)
            {
                if (Refuse)
                {
                    return base.MoveNode(node, target, position, context, request);
                }

                Moved = $"{node}>{target}:{position}";

                return true;
            }
        }
    }
}
