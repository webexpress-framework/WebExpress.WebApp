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
    /// the in-memory <see cref="TestRestApiPermission"/> implementation. The
    /// store holds the pair (group, policy) while the wire surface is one entry
    /// per group, so the tests assert both sides of that projection.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestRestApiPermission
    {
        /// <summary>
        /// Builds the incident-flavored seed used by the retrieval tests.
        /// IT Support carries two policies, so the projection of several pairs
        /// onto one entry shows up in the seeded data.
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
        /// Reads the policy ids of an entry.
        /// </summary>
        /// <param name="entry">The parsed entry.</param>
        /// <returns>The policy ids.</returns>
        private static List<string> ReadPolicyIds(JsonElement entry) =>
            [.. entry.GetProperty("policyIds").EnumerateArray().Select(x => x.GetString())];

        /// <summary>
        /// Reads the assigned group ids of a response.
        /// </summary>
        /// <param name="root">The parsed response root.</param>
        /// <returns>The group ids.</returns>
        private static List<string> ReadAssignedGroupIds(JsonElement root) =>
            [.. root.GetProperty("assignedGroupIds").EnumerateArray().Select(x => x.GetString())];

        /// <summary>
        /// Parses the JSON body of a response.
        /// </summary>
        /// <param name="content">The response content.</param>
        /// <returns>The parsed document.</returns>
        private static JsonDocument Parse(object content) =>
            JsonDocument.Parse(Encoding.UTF8.GetString((byte[])content));

        /// <summary>
        /// Verifies that <c>GET</c> projects the seeded pairs onto one entry
        /// per group and reports the total and the assigned groups.
        /// </summary>
        [Fact]
        public void Retrieve_GroupsSeededAssignments()
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

            using var doc = Parse(result.Content);
            var root = doc.RootElement;
            Assert.Equal(3, root.GetProperty("total").GetInt32());

            var items = root.GetProperty("items").EnumerateArray().ToList();
            Assert.Equal(3, items.Count);
            Assert.Equal("g1", items[0].GetProperty("groupId").GetString());
            Assert.Equal("IT Support", items[0].GetProperty("groupName").GetString());
            Assert.Equal(["p1", "p2"], ReadPolicyIds(items[0]));
            Assert.Equal(["p2"], ReadPolicyIds(items[1]));

            Assert.Equal(["g1", "g2", "g3"], ReadAssignedGroupIds(root));
        }

        /// <summary>
        /// Verifies that <c>GET</c> pages the entries through the <c>p</c> and
        /// <c>l</c> parameters while the total and the assigned groups stay the
        /// pre-paging values.
        /// </summary>
        [Fact]
        public void Retrieve_PagesEntries()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiPermission(CreateSeed());
            var request = UnitTestControlFixture.CreateRequestMock("", "https://example.com/");
            request.AddParameter(new Parameter("p", "1", ParameterScope.Parameter));
            request.AddParameter(new Parameter("l", "2", ParameterScope.Parameter));

            // act
            var result = api.Retrieve(request);

            // validation
            Assert.Equal(200, result.Status);

            using var doc = Parse(result.Content);
            var root = doc.RootElement;
            Assert.Equal(3, root.GetProperty("total").GetInt32());

            var items = root.GetProperty("items").EnumerateArray().ToList();
            Assert.Single(items);
            Assert.Equal("g3", items[0].GetProperty("groupId").GetString());

            Assert.Equal(3, ReadAssignedGroupIds(root).Count);
        }

        /// <summary>
        /// Verifies that <c>GET</c> filters the entries through the <c>q</c>
        /// parameter against the group name, while the assigned groups stay
        /// unfiltered so the add row keeps excluding every assigned group.
        /// </summary>
        [Fact]
        public void Retrieve_FiltersEntries()
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

            using var doc = Parse(result.Content);
            var root = doc.RootElement;
            Assert.Equal(1, root.GetProperty("total").GetInt32());

            var items = root.GetProperty("items").EnumerateArray().ToList();
            Assert.Single(items);
            Assert.Equal("Service Desk", items[0].GetProperty("groupName").GetString());

            Assert.Equal(["g1", "g2", "g3"], ReadAssignedGroupIds(root));
        }

        /// <summary>
        /// Verifies that <c>POST</c> resolves the group against the directory
        /// and stores one pair per requested policy.
        /// </summary>
        [Fact]
        public void Create_AddsEntryWithPolicySet()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var groups = new Dictionary<string, RestApiPermissionGroup>
            {
                ["g1"] = new() { Id = "g1", Name = "IT Support" }
            };
            var policies = new Dictionary<string, RestApiPermissionPolicy>
            {
                ["p1"] = new() { Id = "p1", Name = "class_edit_policy" },
                ["p2"] = new() { Id = "p2", Name = "class_view_policy" }
            };
            var api = new TestRestApiPermission(groups: groups, policies: policies);
            var request = UnitTestControlFixture.CreateRequestMock
            (
                "POST / HTTP/1.1\r\n" +
                "Host: localhost\r\n" +
                "Content-Type: application/json\r\n" +
                "\r\n" +
                "{\"groupId\":\"g1\",\"policyIds\":[\"p1\",\"p2\"]}",
                "https://example.com/"
            );

            // act
            var result = api.Create(request);

            // validation
            Assert.NotNull(result);
            Assert.Equal(200, result.Status);

            using var doc = Parse(result.Content);
            var root = doc.RootElement;
            Assert.Equal("g1", root.GetProperty("groupId").GetString());
            Assert.Equal(["p1", "p2"], ReadPolicyIds(root));

            Assert.Equal(2, api.Assignments.Count);
        }

        /// <summary>
        /// Verifies that <c>POST</c> for a group that already carries the
        /// requested policy leaves the store unchanged.
        /// </summary>
        [Fact]
        public void Create_IsIdempotent_ForExistingPolicySet()
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
                "{\"groupId\":\"g1\",\"policyIds\":[\"p1\"]}",
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
                "{\"groupId\":\"ghost\",\"policyIds\":[\"p1\"]}",
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
        /// Verifies that <c>PUT {groupId}</c> reconciles the stored pairs
        /// against the requested policy set, which is the write the inline
        /// editing of the chips performs.
        /// </summary>
        [Fact]
        public void Update_ReplacesPolicySetOfGroup()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var seed = new List<RestApiPermissionItem>
            {
                new() { GroupId = "g1", GroupName = "IT Support", PolicyId = "p1", PolicyName = "class_edit_policy" },
                new() { GroupId = "g1", GroupName = "IT Support", PolicyId = "p2", PolicyName = "class_view_policy" }
            };
            var policies = new Dictionary<string, RestApiPermissionPolicy>
            {
                ["p1"] = new() { Id = "p1", Name = "class_edit_policy" },
                ["p2"] = new() { Id = "p2", Name = "class_view_policy" },
                ["p3"] = new() { Id = "p3", Name = "class_admin_policy" }
            };
            var groups = new Dictionary<string, RestApiPermissionGroup>
            {
                ["g1"] = new() { Id = "g1", Name = "IT Support" }
            };
            var api = new TestRestApiPermission(seed, groups, policies);
            var request = UnitTestControlFixture.CreateRequestMock
            (
                "PUT /g1 HTTP/1.1\r\n" +
                "Host: localhost\r\n" +
                "Content-Type: application/json\r\n" +
                "\r\n" +
                "{\"policyIds\":[\"p1\",\"p3\"]}",
                "https://example.com/g1"
            );

            // act
            var result = api.Update(request);

            // validation
            Assert.Equal(200, result.Status);

            using var doc = Parse(result.Content);
            Assert.Equal(["p1", "p3"], ReadPolicyIds(doc.RootElement));

            Assert.Equal(["p1", "p3"], api.Assignments.Select(x => x.PolicyId));
        }

        /// <summary>
        /// Verifies that <c>PUT</c> without a group segment yields 404, because
        /// the group is the identity of an entry.
        /// </summary>
        [Fact]
        public void Update_ReturnsNotFound_WithoutGroupSegment()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiPermission();
            var request = UnitTestControlFixture.CreateRequestMock
            (
                "PUT / HTTP/1.1\r\n" +
                "Host: localhost\r\n" +
                "Content-Type: application/json\r\n" +
                "\r\n" +
                "{\"policyIds\":[]}",
                "https://example.com/"
            );

            // act
            var result = api.Update(request);

            // validation
            Assert.Equal(404, result.Status);
        }

        /// <summary>
        /// Verifies that <c>DELETE {groupId}</c> revokes every policy of the
        /// group and leaves the other groups untouched.
        /// </summary>
        [Fact]
        public void Delete_RemovesEveryPolicyOfGroup()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var seed = new List<RestApiPermissionItem>
            {
                new() { GroupId = "g1", GroupName = "IT Support",   PolicyId = "p1", PolicyName = "class_edit_policy" },
                new() { GroupId = "g1", GroupName = "IT Support",   PolicyId = "p2", PolicyName = "class_view_policy" },
                new() { GroupId = "g2", GroupName = "Service Desk", PolicyId = "p2", PolicyName = "class_view_policy" }
            };
            var api = new TestRestApiPermission(seed);
            var request = UnitTestControlFixture.CreateRequestMock("", "https://example.com/g1");

            // act
            var result = api.Delete(request);

            // validation
            Assert.NotNull(result);
            Assert.Equal(204, result.Status);
            Assert.Single(api.Assignments);
            Assert.Equal("g2", api.Assignments[0].GroupId);
        }

        /// <summary>
        /// Verifies that <c>DELETE</c> against a group without assignments
        /// yields 404 and leaves the store untouched.
        /// </summary>
        [Fact]
        public void Delete_ReturnsNotFound_WhenGroupMissing()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var seed = new List<RestApiPermissionItem>
            {
                new() { GroupId = "g1", GroupName = "IT Support", PolicyId = "p1", PolicyName = "class_edit_policy" }
            };
            var api = new TestRestApiPermission(seed);
            var request = UnitTestControlFixture.CreateRequestMock("", "https://example.com/ghost");

            // act
            var result = api.Delete(request);

            // validation
            Assert.NotNull(result);
            Assert.Equal(404, result.Status);
            Assert.Single(api.Assignments);
        }

        /// <summary>
        /// Verifies that <c>DELETE</c> with a pair path yields 404, because the
        /// surface revokes a whole group rather than a single assignment.
        /// </summary>
        [Fact]
        public void Delete_ReturnsNotFound_OnPairPath()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiPermission();
            var request = UnitTestControlFixture.CreateRequestMock("", "https://example.com/g1/p1");

            // act
            var result = api.Delete(request);

            // validation
            Assert.NotNull(result);
            Assert.Equal(404, result.Status);
        }
    }
}
