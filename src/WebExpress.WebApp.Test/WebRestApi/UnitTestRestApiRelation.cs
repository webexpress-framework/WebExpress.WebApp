using System.Text;
using System.Text.Json;
using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebRelation;

namespace WebExpress.WebApp.Test.WebRestApi
{
    /// <summary>
    /// Provides unit tests for the <see cref="WebApp.WebRestApi.RestApiRelation"/>
    /// abstract endpoint, exercised through the in-memory
    /// <see cref="TestRestApiRelation"/> implementation. They cover what the base
    /// class contributes: the grouping by relation, the perspective that decides
    /// which of the two labels applies, the counts of the two categories and the
    /// validation a refused link is answered with.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestRestApiRelation : IDisposable
    {
        /// <summary>
        /// The object every test renders its surface for.
        /// </summary>
        private static RelationReference Subject => new() { Key = "INC-00123", Class = "Incident" };

        /// <summary>
        /// Restores the shipped catalog after a test that changed it.
        /// </summary>
        public void Dispose()
        {
            RelationRegistry.Reset();
            GC.SuppressFinalize(this);
        }

        /// <summary>
        /// Verifies that a surface without an addressed object answers not
        /// found rather than an empty result, so a broken route is visible.
        /// </summary>
        [Fact]
        public void Retrieve_ReturnsNotFound_WithoutASubject()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiRelation();
            var request = UnitTestControlFixture.CreateRequestMock("", "https://example.com/");

            // act
            var result = api.Retrieve(request);

            // validation
            Assert.Equal(404, result.Status);
        }

        /// <summary>
        /// Verifies that the links are grouped by their relation and that the
        /// group carries both of its labels.
        /// </summary>
        [Fact]
        public void Retrieve_GroupsByRelation()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiRelation(Subject, [
                ObjectLink("l1", "INC-00123", "CHG-00045", RelationType.Blocks),
                ObjectLink("l2", "INC-00123", "DOC-00318", RelationType.References),
                ObjectLink("l3", "INC-00123", "DOC-00204", RelationType.References)
            ]);
            var request = UnitTestControlFixture.CreateRequestMock("", "https://example.com/");

            // act
            var root = Read(api.Retrieve(request));

            // validation
            var groups = root.GetProperty("groups").EnumerateArray().ToList();
            Assert.Equal(2, groups.Count);
            Assert.Equal(RelationType.Blocks, groups[0].GetProperty("type").GetString());
            Assert.Equal(1, groups[0].GetProperty("count").GetInt32());
            Assert.Equal(RelationType.References, groups[1].GetProperty("type").GetString());
            Assert.Equal(2, groups[1].GetProperty("count").GetInt32());
            Assert.Equal(3, root.GetProperty("total").GetInt32());
        }

        /// <summary>
        /// Verifies that one relation yields two groups when the object sits on
        /// both ends of it, which is what makes "blocks" and "is blocked by" two
        /// headings of one type.
        /// </summary>
        [Fact]
        public void Retrieve_SplitsARelationByTheEndTheObjectSitsOn()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiRelation(Subject, [
                ObjectLink("l1", "INC-00123", "CHG-1", RelationType.Blocks),
                ObjectLink("l2", "CHG-2", "INC-00123", RelationType.Blocks)
            ]);
            var request = UnitTestControlFixture.CreateRequestMock("", "https://example.com/");

            // act
            var root = Read(api.Retrieve(request));

            // validation
            var groups = root.GetProperty("groups").EnumerateArray().ToList();
            Assert.Equal(2, groups.Count);
            Assert.False(groups[0].GetProperty("inverse").GetBoolean());
            Assert.True(groups[1].GetProperty("inverse").GetBoolean());
            Assert.True(groups[1].GetProperty("items")[0].GetProperty("inverse").GetBoolean());
        }

        /// <summary>
        /// Verifies that the group of a symmetric relation carries no
        /// counterpart, because both sides read alike.
        /// </summary>
        [Fact]
        public void Retrieve_LeavesTheCounterpartOfASymmetricRelationEmpty()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiRelation(Subject, [ObjectLink("l1", "INC-00123", "INC-2", RelationType.Similar)]);
            var request = UnitTestControlFixture.CreateRequestMock("", "https://example.com/");

            // act
            var root = Read(api.Retrieve(request));

            // validation
            var group = root.GetProperty("groups")[0];
            Assert.True(group.GetProperty("symmetric").GetBoolean());
            Assert.Equal(JsonValueKind.Null, group.GetProperty("counterpart").ValueKind);
        }

        /// <summary>
        /// Verifies that the surface reports the number of both categories even
        /// while it lists only one, because the two tabs are shown side by side.
        /// </summary>
        [Fact]
        public void Retrieve_ReportsBothCategoryCounts()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiRelation(Subject, [
                ObjectLink("l1", "INC-00123", "CHG-1", RelationType.Blocks),
                WebLink("l2", "INC-00123", "https://example.com/a"),
                WebLink("l3", "INC-00123", "https://example.com/b")
            ]);
            var request = Get("?kind=object");

            // act
            var root = Read(api.Retrieve(request));

            // validation
            Assert.Equal(1, root.GetProperty("total").GetInt32());
            Assert.Equal(1, root.GetProperty("objectCount").GetInt32());
            Assert.Equal(2, root.GetProperty("externalCount").GetInt32());
            Assert.Single(root.GetProperty("groups").EnumerateArray());
        }

        /// <summary>
        /// Verifies that the relation filter narrows the answer.
        /// </summary>
        [Fact]
        public void Retrieve_FiltersByRelation()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiRelation(Subject, [
                ObjectLink("l1", "INC-00123", "CHG-1", RelationType.Blocks),
                ObjectLink("l2", "INC-00123", "DOC-1", RelationType.References)
            ]);
            var request = Get("?type=references");

            // act
            var root = Read(api.Retrieve(request));

            // validation
            var groups = root.GetProperty("groups").EnumerateArray().ToList();
            Assert.Single(groups);
            Assert.Equal(RelationType.References, groups[0].GetProperty("type").GetString());
        }

        /// <summary>
        /// Verifies that a link is established from the object the surface
        /// belongs to.
        /// </summary>
        [Fact]
        public void Create_EstablishesTheLinkFromTheSubject()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiRelation(Subject, objects: ["INC-00123", "CHG-00045"]);
            var request = Post("{\"system\":\"" + RelationSystem.Object + "\",\"type\":\"blocks\",\"targetKey\":\"CHG-00045\",\"targetClass\":\"Change\",\"comment\":\"same gateway\"}");

            // act
            var result = api.Create(request);
            var root = Read(result);

            // validation
            Assert.Equal(200, result.Status);
            Assert.Equal("INC-00123", root.GetProperty("source").GetProperty("key").GetString());
            Assert.Equal("CHG-00045", root.GetProperty("target").GetProperty("key").GetString());
            Assert.Equal("same gateway", root.GetProperty("comment").GetString());
            Assert.Single(api.Links);
        }

        /// <summary>
        /// Verifies that a web link is stored as an address rather than as an
        /// object reference, through the same payload and the same entity.
        /// </summary>
        [Fact]
        public void Create_EstablishesAWebLink()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiRelation(Subject);
            var request = Post("{\"system\":\"" + RelationSystem.Web + "\",\"type\":\"weblink\",\"address\":\"https://example.com/advisory\",\"title\":\"Advisory\"}");

            // act
            var result = api.Create(request);
            var root = Read(result);

            // validation
            Assert.Equal(200, result.Status);
            Assert.Equal("https://example.com/advisory", root.GetProperty("target").GetProperty("uri").GetString());
            Assert.Equal("Advisory", root.GetProperty("target").GetProperty("title").GetString());
        }

        /// <summary>
        /// Verifies that a refused link is answered with the machine readable
        /// reason, so the client can translate it instead of matching on prose.
        /// </summary>
        [Theory]
        [InlineData("{\"system\":\"nonsense\",\"type\":\"blocks\",\"targetKey\":\"CHG-1\"}", RelationValidationResult.UnknownSystem)]
        [InlineData("{\"system\":\"webexpress.webapp.relation.object\",\"type\":\"nonsense\",\"targetKey\":\"CHG-1\"}", RelationValidationResult.UnknownType)]
        [InlineData("{\"system\":\"webexpress.webapp.relation.object\",\"type\":\"blocks\",\"targetKey\":\"GHOST\"}", RelationValidationResult.UnknownTarget)]
        [InlineData("{\"system\":\"webexpress.webapp.relation.object\",\"type\":\"blocks\",\"targetKey\":\"INC-00123\"}", RelationValidationResult.SelfReference)]
        [InlineData("{\"system\":\"webexpress.webapp.relation.web\",\"type\":\"weblink\",\"address\":\"nonsense\"}", RelationValidationResult.InvalidAddress)]
        public void Create_RefusesAnInvalidLinkWithItsReason(string body, string expected)
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiRelation(Subject, objects: ["INC-00123", "CHG-1"]);

            // act
            var result = api.Create(Post(body));

            // validation
            Assert.Equal(400, result.Status);
            Assert.Equal(expected, Read(result).GetProperty("code").GetString());
            Assert.Empty(api.Links);
        }

        /// <summary>
        /// Verifies that the same relation is not stored twice.
        /// </summary>
        [Fact]
        public void Create_RefusesADuplicate()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiRelation(Subject, [ObjectLink("l1", "INC-00123", "CHG-1", RelationType.Blocks)], ["INC-00123", "CHG-1"]);
            var request = Post("{\"system\":\"" + RelationSystem.Object + "\",\"type\":\"blocks\",\"targetKey\":\"CHG-1\"}");

            // act
            var result = api.Create(request);

            // validation
            Assert.Equal(400, result.Status);
            Assert.Equal(RelationValidationResult.Duplicate, Read(result).GetProperty("code").GetString());
        }

        /// <summary>
        /// Verifies that an empty body is refused rather than stored as an empty
        /// link.
        /// </summary>
        [Fact]
        public void Create_ReturnsBadRequest_WithoutAPayload()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiRelation(Subject);
            var request = UnitTestControlFixture.CreateRequestMock("", "https://example.com/");

            // act
            var result = api.Create(request);

            // validation
            Assert.Equal(400, result.Status);
        }

        /// <summary>
        /// Verifies that an update changes the lifecycle state and the note of a
        /// link, while its two ends stay where they are.
        /// </summary>
        [Fact]
        public void Update_ChangesTheStatusAndKeepsTheEnds()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var link = ObjectLink("l1", "INC-00123", "CHG-1", RelationType.Blocks);
            var api = new TestRestApiRelation(Subject, [link]);
            var request = Put("l1", "{\"status\":\"obsolete\",\"comment\":\"resolved\"}");

            // act
            var result = api.Update(request);
            var root = Read(result);

            // validation
            Assert.Equal(200, result.Status);
            Assert.Equal("obsolete", root.GetProperty("status").GetString());
            Assert.Equal("resolved", root.GetProperty("comment").GetString());
            Assert.Equal("CHG-1", link.Target.Key);
        }

        /// <summary>
        /// Verifies that an update of an unknown link answers not found.
        /// </summary>
        [Fact]
        public void Update_ReturnsNotFound_ForAnUnknownLink()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiRelation(Subject);

            // act
            var result = api.Update(Put("ghost", "{\"status\":\"obsolete\"}"));

            // validation
            Assert.Equal(404, result.Status);
        }

        /// <summary>
        /// Verifies that a link is removed by its own identity.
        /// </summary>
        [Fact]
        public void Delete_RemovesTheLink()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiRelation(Subject, [ObjectLink("l1", "INC-00123", "CHG-1", RelationType.Blocks)]);
            var request = UnitTestControlFixture.CreateRequestMock("", "https://example.com/l1");

            // act
            var result = api.Delete(request);

            // validation
            Assert.Equal(204, result.Status);
            Assert.Empty(api.Links);
        }

        /// <summary>
        /// Verifies that deleting an unknown link answers not found.
        /// </summary>
        [Fact]
        public void Delete_ReturnsNotFound_ForAnUnknownLink()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiRelation(Subject);
            var request = UnitTestControlFixture.CreateRequestMock("", "https://example.com/ghost");

            // act
            var result = api.Delete(request);

            // validation
            Assert.Equal(404, result.Status);
        }

        /// <summary>
        /// Verifies that a relation a plugin registered is served without a
        /// change to the endpoint, which is the point of the generic entity.
        /// </summary>
        [Fact]
        public void Create_ServesARelationAPluginContributed()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            RelationRegistry.RegisterSystem(new RelationSystem { Id = "acme.github", Label = "GitHub", Kind = RelationKind.Object, Plugin = "acme.github" });
            RelationRegistry.RegisterType(new RelationType { Id = "gh.pull", Label = "pull request", InverseLabel = "belongs to", System = "acme.github" });

            var api = new TestRestApiRelation(Subject, objects: ["INC-00123", "PR-7"]);
            var request = Post("{\"system\":\"acme.github\",\"type\":\"gh.pull\",\"targetKey\":\"PR-7\"}");

            // act
            var result = api.Create(request);

            // validation
            Assert.Equal(200, result.Status);
            Assert.Equal("acme.github", Read(result).GetProperty("system").GetString());
        }

        /// <summary>
        /// Builds a link between two objects of the native object system.
        /// </summary>
        /// <param name="id">The identity of the link.</param>
        /// <param name="source">The key of the source.</param>
        /// <param name="target">The key of the target.</param>
        /// <param name="type">The id of the relation.</param>
        /// <returns>The link.</returns>
        private static Relation ObjectLink(string id, string source, string target, string type)
        {
            return new Relation
            {
                Id = id,
                System = RelationSystem.Object,
                Type = type,
                Source = new RelationReference { Key = source, Class = "Incident" },
                Target = new RelationReference { Key = target, Class = "Change" }
            };
        }

        /// <summary>
        /// Builds a link to an address outside the application.
        /// </summary>
        /// <param name="id">The identity of the link.</param>
        /// <param name="source">The key of the source.</param>
        /// <param name="address">The external address.</param>
        /// <returns>The link.</returns>
        private static Relation WebLink(string id, string source, string address)
        {
            return new Relation
            {
                Id = id,
                System = RelationSystem.Web,
                Type = RelationType.WebLink,
                Source = new RelationReference { Key = source, Class = "Incident" },
                Target = new RelationReference { Uri = address, Title = address }
            };
        }

        /// <summary>
        /// Builds a GET request against the endpoint base. The query travels in
        /// the request line, which is where the request mock reads it from.
        /// </summary>
        /// <param name="query">The query string, including the leading question mark.</param>
        /// <returns>The request.</returns>
        private static WebCore.WebMessage.IRequest Get(string query)
        {
            return UnitTestControlFixture.CreateRequestMock(
                "GET /" + query + " HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\n\r\n",
                "https://example.com/");
        }

        /// <summary>
        /// Builds a POST request against the endpoint base.
        /// </summary>
        /// <param name="body">The json body.</param>
        /// <returns>The request.</returns>
        private static WebCore.WebMessage.IRequest Post(string body)
        {
            return UnitTestControlFixture.CreateRequestMock(
                "POST / HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\n\r\n" + body,
                "https://example.com/");
        }

        /// <summary>
        /// Builds a PUT request against one link.
        /// </summary>
        /// <param name="id">The identity of the link.</param>
        /// <param name="body">The json body.</param>
        /// <returns>The request.</returns>
        private static WebCore.WebMessage.IRequest Put(string id, string body)
        {
            return UnitTestControlFixture.CreateRequestMock(
                "PUT /" + id + " HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\n\r\n" + body,
                "https://example.com/" + id);
        }

        /// <summary>
        /// Parses the json body of a response.
        /// </summary>
        /// <param name="response">The response.</param>
        /// <returns>The root element.</returns>
        private static JsonElement Read(WebCore.WebMessage.IResponse response)
        {
            var json = Encoding.UTF8.GetString((byte[])response.Content);

            return JsonDocument.Parse(json).RootElement.Clone();
        }
    }
}
