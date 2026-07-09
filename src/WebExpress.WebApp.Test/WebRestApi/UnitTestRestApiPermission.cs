using System.Text;
using System.Text.Json;
using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebRestApi;
using WebExpress.WebCore.WebParameter;

namespace WebExpress.WebApp.Test.WebRestApi
{
    /// <summary>
    /// Provides unit tests for verifying the behavior of the
    /// <see cref="RestApiPermission"/> abstract endpoint, exercised through
    /// the in-memory <see cref="TestRestApiPermission"/> implementation. An
    /// assignment is the pair (group, policy); a group may carry several
    /// policies.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestRestApiPermission
    {
        /// <summary>
        /// Builds the incident-flavored seed used by the retrieval tests.
        /// IT Support carries two policies, so the pair semantics show up in
        /// the seeded data.
        /// </summary>
        /// <returns>The seeded assignments.</returns>
        private static List<RestApiPermissionItem> CreateSeed() =>
        [
            new() { GroupId = "g1", GroupName = "IT Support",        PolicyId = "p1", PolicyName = "class_edit_policy" },
            new() { GroupId = "g1", GroupName = "IT Support",        PolicyId = "p2", PolicyName = "class_view_policy" },
            new() { GroupId = "g2", GroupName = "Service Desk",      PolicyId = "p2", PolicyName = "class_view_policy" },
            new() { GroupId = "g3", GroupName = "Incident Managers", PolicyId = "p3", PolicyName = "class_admin_policy" }
        ];

        /// <summary>
        /// Reads the assigned pairs of a response as "groupId:policyId" strings.
        /// </summary>
        /// <param name="root">The parsed response root.</param>
        /// <returns>The pair strings.</returns>
        private static List<string> ReadPairs(JsonElement root) =>
            [.. root.GetProperty("assignedPairs").EnumerateArray()
                .Select(x => $"{x.GetProperty("groupId").GetString()}:{x.GetProperty("policyId").GetString()}")];

        /// <summary>
        /// Verifies that <c>GET</c> returns the seeded assignments together
        /// with the total and the full pair set as a paged JSON object.
        /// </summary>
        [Fact]
        public void Retrieve_ReturnsSeededAssignments()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiPermission(CreateSeed());
            var request = UnitTestControlFixture.CreateRequestMock("", "https://example.com/");

            // act
            var result = api.Retrieve(request);

            // validation
            Assert.NotNull(result);
            Assert.Equal(200, result.Status);

            var json = Encoding.UTF8.GetString((byte[])result.Content);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            Assert.Equal(4, root.GetProperty("total").GetInt32());

            var items = root.GetProperty("items").EnumerateArray().ToList();
            Assert.Equal(4, items.Count);
            Assert.Equal("g1", items[0].GetProperty("groupId").GetString());
            Assert.Equal("IT Support", items[0].GetProperty("groupName").GetString());
            Assert.Equal("class_view_policy", items[1].GetProperty("policyName").GetString());

            Assert.Equal(["g1:p1", "g1:p2", "g2:p2", "g3:p3"], ReadPairs(root));
        }

        /// <summary>
        /// Verifies that <c>GET</c> pages the assignments through the
        /// <c>p</c> and <c>l</c> parameters while the total and the pair set
        /// stay the pre-paging values.
        /// </summary>
        [Fact]
        public void Retrieve_PagesAssignments()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiPermission(CreateSeed());
            var request = UnitTestControlFixture.CreateRequestMock("", "https://example.com/");
            request.AddParameter(new Parameter("p", "1", ParameterScope.Parameter));
            request.AddParameter(new Parameter("l", "3", ParameterScope.Parameter));

            // act
            var result = api.Retrieve(request);

            // validation
            Assert.Equal(200, result.Status);

            var json = Encoding.UTF8.GetString((byte[])result.Content);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            Assert.Equal(4, root.GetProperty("total").GetInt32());

            var items = root.GetProperty("items").EnumerateArray().ToList();
            Assert.Single(items);
            Assert.Equal("g3", items[0].GetProperty("groupId").GetString());

            Assert.Equal(4, ReadPairs(root).Count);
        }

        /// <summary>
        /// Verifies that <c>GET</c> filters the assignments through the
        /// <c>q</c> parameter against the group and policy names, while the
        /// pair set stays unfiltered so the assign selects keep excluding
        /// every assigned pair.
        /// </summary>
        [Fact]
        public void Retrieve_FiltersAssignments()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiPermission(CreateSeed());
            var request = UnitTestControlFixture.CreateRequestMock("", "https://example.com/");
            request.AddParameter(new Parameter("q", "desk", ParameterScope.Parameter));

            // act
            var result = api.Retrieve(request);

            // validation
            Assert.Equal(200, result.Status);

            var json = Encoding.UTF8.GetString((byte[])result.Content);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            Assert.Equal(1, root.GetProperty("total").GetInt32());

            var items = root.GetProperty("items").EnumerateArray().ToList();
            Assert.Single(items);
            Assert.Equal("Service Desk", items[0].GetProperty("groupName").GetString());

            Assert.Equal(["g1:p1", "g1:p2", "g2:p2", "g3:p3"], ReadPairs(root));
        }

        /// <summary>
        /// Verifies that <c>POST</c> resolves the group and the policy
        /// against the directories and appends the assignment pair.
        /// </summary>
        [Fact]
        public void Create_AddsAssignment()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var groups = new Dictionary<string, RestApiPermissionGroup>
            {
                ["g1"] = new() { Id = "g1", Name = "IT Support" }
            };
            var policies = new Dictionary<string, RestApiPermissionPolicy>
            {
                ["p1"] = new() { Id = "p1", Name = "class_edit_policy" }
            };
            var api = new TestRestApiPermission(groups: groups, policies: policies);
            var request = UnitTestControlFixture.CreateRequestMock
            (
                "POST / HTTP/1.1\r\n" +
                "Host: localhost\r\n" +
                "Content-Type: application/json\r\n" +
                "\r\n" +
                "{\"groupId\":\"g1\",\"policyId\":\"p1\"}",
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
            Assert.Equal("g1", root.GetProperty("groupId").GetString());
            Assert.Equal("class_edit_policy", root.GetProperty("policyName").GetString());

            Assert.Single(api.Assignments);
        }

        /// <summary>
        /// Verifies that <c>POST</c> adds a second policy to an already
        /// assigned group, because a group may carry several policies.
        /// </summary>
        [Fact]
        public void Create_AddsSecondPolicyToGroup()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var seed = new List<RestApiPermissionItem>
            {
                new() { GroupId = "g1", GroupName = "IT Support", PolicyId = "p1", PolicyName = "class_edit_policy" }
            };
            var policies = new Dictionary<string, RestApiPermissionPolicy>
            {
                ["p1"] = new() { Id = "p1", Name = "class_edit_policy" },
                ["p3"] = new() { Id = "p3", Name = "class_admin_policy" }
            };
            var api = new TestRestApiPermission(seed, policies: policies);
            var request = UnitTestControlFixture.CreateRequestMock
            (
                "POST / HTTP/1.1\r\n" +
                "Host: localhost\r\n" +
                "Content-Type: application/json\r\n" +
                "\r\n" +
                "{\"groupId\":\"g1\",\"policyId\":\"p3\"}",
                "https://example.com/"
            );

            // act
            var result = api.Create(request);

            // validation
            Assert.Equal(200, result.Status);
            Assert.Equal(2, api.Assignments.Count);
            Assert.Equal(["p1", "p3"], api.Assignments.Where(x => x.GroupId == "g1").Select(x => x.PolicyId));
        }

        /// <summary>
        /// Verifies that <c>POST</c> for an already existing pair is
        /// idempotent and leaves the store unchanged.
        /// </summary>
        [Fact]
        public void Create_IsIdempotent_ForExistingPair()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var seed = new List<RestApiPermissionItem>
            {
                new() { GroupId = "g1", GroupName = "IT Support", PolicyId = "p1", PolicyName = "class_edit_policy" }
            };
            var api = new TestRestApiPermission(seed);
            var request = UnitTestControlFixture.CreateRequestMock
            (
                "POST / HTTP/1.1\r\n" +
                "Host: localhost\r\n" +
                "Content-Type: application/json\r\n" +
                "\r\n" +
                "{\"groupId\":\"g1\",\"policyId\":\"p1\"}",
                "https://example.com/"
            );

            // act
            var result = api.Create(request);

            // validation
            Assert.Equal(200, result.Status);
            Assert.Single(api.Assignments);
        }

        /// <summary>
        /// Verifies that <c>POST</c> against an unknown group id yields 404.
        /// </summary>
        [Fact]
        public void Create_ReturnsNotFound_WhenGroupMissing()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiPermission();
            var request = UnitTestControlFixture.CreateRequestMock
            (
                "POST / HTTP/1.1\r\n" +
                "Host: localhost\r\n" +
                "Content-Type: application/json\r\n" +
                "\r\n" +
                "{\"groupId\":\"ghost\",\"policyId\":\"p1\"}",
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
            var api = new TestRestApiPermission();
            var request = UnitTestControlFixture.CreateRequestMock("", "https://example.com/");

            // act
            var result = api.Create(request);

            // validation
            Assert.NotNull(result);
            Assert.Equal(400, result.Status);
        }

        /// <summary>
        /// Verifies that <c>DELETE {groupId}/{policyId}</c> returns 204 when
        /// the pair existed, removes it and keeps the group's other policies.
        /// </summary>
        [Fact]
        public void Delete_RemovesExistingPair()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var seed = new List<RestApiPermissionItem>
            {
                new() { GroupId = "g1", GroupName = "IT Support", PolicyId = "p1", PolicyName = "class_edit_policy" },
                new() { GroupId = "g1", GroupName = "IT Support", PolicyId = "p2", PolicyName = "class_view_policy" }
            };
            var api = new TestRestApiPermission(seed);
            var request = UnitTestControlFixture.CreateRequestMock("", "https://example.com/g1/p1");

            // act
            var result = api.Delete(request);

            // validation
            Assert.NotNull(result);
            Assert.Equal(204, result.Status);
            Assert.Single(api.Assignments);
            Assert.Equal("p2", api.Assignments[0].PolicyId);
        }

        /// <summary>
        /// Verifies that <c>DELETE {groupId}/{policyId}</c> against an
        /// unknown pair yields 404 and leaves the store untouched.
        /// </summary>
        [Fact]
        public void Delete_ReturnsNotFound_WhenPairMissing()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var seed = new List<RestApiPermissionItem>
            {
                new() { GroupId = "g1", GroupName = "IT Support", PolicyId = "p1", PolicyName = "class_edit_policy" }
            };
            var api = new TestRestApiPermission(seed);
            var request = UnitTestControlFixture.CreateRequestMock("", "https://example.com/g1/ghost");

            // act
            var result = api.Delete(request);

            // validation
            Assert.NotNull(result);
            Assert.Equal(404, result.Status);
            Assert.Single(api.Assignments);
        }

        /// <summary>
        /// Verifies that <c>DELETE</c> with only one segment (no policy id)
        /// yields 404, because the pair is the identity of an assignment.
        /// </summary>
        [Fact]
        public void Delete_ReturnsNotFound_OnGroupOnlyPath()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiPermission();
            var request = UnitTestControlFixture.CreateRequestMock("", "https://example.com/g1");

            // act
            var result = api.Delete(request);

            // validation
            Assert.NotNull(result);
            Assert.Equal(404, result.Status);
        }
    }
}
