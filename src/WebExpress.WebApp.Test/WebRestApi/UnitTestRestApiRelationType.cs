using System.Text;
using System.Text.Json;
using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebRelation;

namespace WebExpress.WebApp.Test.WebRestApi
{
    /// <summary>
    /// Provides unit tests for the
    /// <see cref="WebApp.WebRestApi.RestApiRelationType"/> abstract endpoint,
    /// exercised through the in-memory <see cref="TestRestApiRelationType"/>
    /// implementation. They cover the catalog it answers, the completeness rules
    /// a definition has to satisfy, the reordering and the guard that keeps a
    /// relation in use from being dropped.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestRestApiRelationType
    {
        /// <summary>
        /// Verifies that the catalog carries the two counts of the caption next
        /// to the items, and the classes the editor offers.
        /// </summary>
        [Fact]
        public void Retrieve_AnswersTheCatalogWithItsCounts()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiRelationType([
                Type("blocks", "blocks", "is blocked by"),
                Type("similar", "similar to", null, symmetric: true),
                Type("replaces", "replaces", "is replaced by", active: false)
            ]);

            // act
            var root = Read(api.Retrieve(Get("")));

            // validation
            Assert.Equal(3, root.GetProperty("total").GetInt32());
            Assert.Equal(2, root.GetProperty("active").GetInt32());
            Assert.Equal(3, root.GetProperty("items").GetArrayLength());
            Assert.Equal(2, root.GetProperty("classes").GetArrayLength());
        }

        /// <summary>
        /// Verifies that a relation reads alike from both ends when it is
        /// symmetric, and that a relation without target classes is marked as
        /// accepting every class.
        /// </summary>
        [Fact]
        public void Retrieve_ProjectsTheDefinitionAsTheTableReadsIt()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiRelationType([Type("similar", "similar to", null, symmetric: true)]);

            // act
            var item = Read(api.Retrieve(Get(""))).GetProperty("items")[0];

            // validation
            Assert.Equal("similar to", item.GetProperty("label").GetString());
            Assert.Equal("similar to", item.GetProperty("inverse").GetString());
            Assert.True(item.GetProperty("allClasses").GetBoolean());
            Assert.Equal("n:n", item.GetProperty("cardinality").GetString());
        }

        /// <summary>
        /// Verifies that the usage count travels with each relation, because it
        /// is what an administrator judges a change by.
        /// </summary>
        [Fact]
        public void Retrieve_ReportsHowOftenARelationIsUsed()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiRelationType(
                [Type("blocks", "blocks", "is blocked by")],
                new Dictionary<string, int> { ["blocks"] = 34 },
                ["blocks"]);

            // act
            var item = Read(api.Retrieve(Get(""))).GetProperty("items")[0];

            // validation
            Assert.Equal(34, item.GetProperty("usage").GetInt32());
            Assert.True(item.GetProperty("builtin").GetBoolean());
        }

        /// <summary>
        /// Verifies that the class filter narrows the catalog to the relations
        /// the class may hold, while a relation that accepts every class always
        /// passes.
        /// </summary>
        [Fact]
        public void Retrieve_FiltersByClass()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var narrow = Type("narrow", "narrow", "narrow");
            ((RelationType)narrow).TargetClasses.Add("Change");

            var api = new TestRestApiRelationType([Type("references", "references", "is referenced by"), narrow]);

            // act
            var ids = Read(api.Retrieve(Get("?class=Bug")))
                .GetProperty("items")
                .EnumerateArray()
                .Select(x => x.GetProperty("id").GetString())
                .ToList();

            // validation
            Assert.Equal(["references"], ids);
        }

        /// <summary>
        /// Verifies that a relation defined without an id gets one derived from
        /// its label.
        /// </summary>
        [Fact]
        public void Create_DerivesTheIdFromTheLabel()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiRelationType();

            // act
            var result = api.Create(Post("{\"label\":\"relates to\",\"inverse\":\"is related to\"}"));

            // validation
            Assert.Equal(200, result.Status);
            Assert.Equal("relates-to", Read(result).GetProperty("id").GetString());
            Assert.Single(api.Types);
        }

        /// <summary>
        /// Verifies that a symmetric relation takes its label for both ends, so
        /// the two sides cannot drift apart.
        /// </summary>
        [Fact]
        public void Create_MirrorsTheLabelOfASymmetricRelation()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiRelationType();

            // act
            var result = api.Create(Post("{\"id\":\"similar\",\"label\":\"similar to\",\"symmetric\":true}"));

            // validation
            Assert.Equal(200, result.Status);
            Assert.Equal("similar to", Read(result).GetProperty("inverse").GetString());
        }

        /// <summary>
        /// Verifies that an incomplete or colliding definition is refused with
        /// its machine readable reason.
        /// </summary>
        [Theory]
        [InlineData("{\"label\":\"\",\"inverse\":\"x\"}", "relation.type.label.required")]
        [InlineData("{\"label\":\"blocks\"}", "relation.type.inverse.required")]
        [InlineData("{\"label\":\"blocks\",\"inverse\":\"is blocked by\",\"system\":\"nonsense\"}", RelationValidationResult.UnknownSystem)]
        [InlineData("{\"id\":\"taken\",\"label\":\"blocks\",\"inverse\":\"is blocked by\"}", "relation.type.duplicate")]
        public void Create_RefusesAnInvalidDefinition(string body, string expected)
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiRelationType([Type("taken", "taken", "taken")]);

            // act
            var result = api.Create(Post(body));

            // validation
            Assert.Equal(400, result.Status);
            Assert.Equal(expected, Read(result).GetProperty("code").GetString());
        }

        /// <summary>
        /// Verifies that an edit replaces the stored definition under the same
        /// id, because the stored links reference it.
        /// </summary>
        [Fact]
        public void Update_ReplacesTheDefinitionUnderTheSameId()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiRelationType([Type("blocks", "blocks", "is blocked by")]);

            // act
            var result = api.Update(Put("blocks", "{\"label\":\"holds up\",\"inverse\":\"is held up by\",\"cardinality\":\"1:n\"}"));
            var root = Read(result);

            // validation
            Assert.Equal(200, result.Status);
            Assert.Equal("blocks", root.GetProperty("id").GetString());
            Assert.Equal("holds up", root.GetProperty("label").GetString());
            Assert.Equal("1:n", root.GetProperty("cardinality").GetString());
            Assert.Single(api.Types);
        }

        /// <summary>
        /// Verifies that editing an unknown relation answers not found.
        /// </summary>
        [Fact]
        public void Update_ReturnsNotFound_ForAnUnknownRelation()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiRelationType();

            // act
            var result = api.Update(Put("ghost", "{\"label\":\"x\",\"inverse\":\"y\"}"));

            // validation
            Assert.Equal(404, result.Status);
        }

        /// <summary>
        /// Verifies that a relation that carries no links may be dropped.
        /// </summary>
        [Fact]
        public void Delete_RemovesAnUnusedRelation()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiRelationType([Type("unused", "unused", "unused")]);
            var request = UnitTestControlFixture.CreateRequestMock("", "https://example.com/unused");

            // act
            var result = api.Delete(request);

            // validation
            Assert.Equal(204, result.Status);
            Assert.Empty(api.Types);
        }

        /// <summary>
        /// Verifies that a relation that is still in use is refused rather than
        /// dropped, so the links that reference it keep their meaning.
        /// </summary>
        [Fact]
        public void Delete_RefusesARelationThatIsStillInUse()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiRelationType(
                [Type("blocks", "blocks", "is blocked by")],
                new Dictionary<string, int> { ["blocks"] = 34 });
            var request = UnitTestControlFixture.CreateRequestMock("", "https://example.com/blocks");

            // act
            var result = api.Delete(request);

            // validation
            Assert.Equal(400, result.Status);
            Assert.Equal("relation.type.in.use", Read(result).GetProperty("code").GetString());
            Assert.Single(api.Types);
        }

        /// <summary>
        /// Verifies that the reorder request rewrites the position of every
        /// relation it names, which is what the drag of one row produces.
        /// </summary>
        [Fact]
        public void Order_RewritesThePositions()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiRelationType([
                Type("a", "a", "a"),
                Type("b", "b", "b"),
                Type("c", "c", "c")
            ]);
            var request = UnitTestControlFixture.CreateRequestMock(
                "POST /order HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\n\r\n{\"ids\":[\"c\",\"a\",\"b\"]}",
                "https://example.com/order");

            // act
            var result = api.Create(request);

            // validation
            Assert.Equal(204, result.Status);
            Assert.Equal(1, api.Types.First(x => x.Id == "c").Order);
            Assert.Equal(2, api.Types.First(x => x.Id == "a").Order);
            Assert.Equal(3, api.Types.First(x => x.Id == "b").Order);
        }

        /// <summary>
        /// Builds a relation type definition.
        /// </summary>
        /// <param name="id">The id.</param>
        /// <param name="label">The label read from the source.</param>
        /// <param name="inverse">The label read from the target.</param>
        /// <param name="symmetric">Whether both ends are named alike.</param>
        /// <param name="active">Whether the relation may be used.</param>
        /// <returns>The type.</returns>
        private static IRelationType Type(string id, string label, string inverse, bool symmetric = false, bool active = true)
        {
            return new RelationType
            {
                Id = id,
                Label = label,
                InverseLabel = symmetric ? label : inverse,
                Symmetric = symmetric,
                Active = active
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
        /// Builds a PUT request against one relation.
        /// </summary>
        /// <param name="id">The id of the relation.</param>
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
