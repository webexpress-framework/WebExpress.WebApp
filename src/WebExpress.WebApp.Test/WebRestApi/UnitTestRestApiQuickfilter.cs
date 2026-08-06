using System.Text;
using System.Text.Json;
using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.Test.Model;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebParameter;

namespace WebExpress.WebApp.Test.WebRestApi
{
    /// <summary>
    /// Provides unit tests for verifying the behavior of the RestApiQuickfilter class.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestRestApiQuickfilter
    {
        /// <summary>
        /// Verifies that the Retrieve method returns the correct cell values for both joined 
        /// and simple fields.
        /// </summary>
        [Fact]
        public void Retrieve()
        {
            // arrange
            var item = new TestIndexItem
            {
                Id = Guid.NewGuid(),
                Key = "A1",
                Names = ["Anna", "Bob"],
                State = "Active",
                Description = "hidden desc"
            };
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var quickfilter = new TestRestApiQuickfilter([item]);
            var request = UnitTestControlFixture.CreateRequestMock();

            // act
            var result = quickfilter.Retrieve(request);

            // validation
            Assert.NotNull(result);
            Assert.Equal(200, result.Status);

            var json = Encoding.UTF8.GetString((byte[])result.Content);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            var items = root.GetProperty("filters").EnumerateArray().ToList();
            Assert.Single(items);

            Assert.NotEmpty(items[0].GetProperty("name").GetString());

            // the typed icon collapses into its css class, the chip color into
            // its button class, the badge carries the count and the system
            // badge color its css class
            Assert.Equal("fas fa-star", items[0].GetProperty("icon").GetString());
            Assert.Equal("btn-success", items[0].GetProperty("color").GetString());
            Assert.Equal("2", items[0].GetProperty("badge").GetString());
            Assert.Equal("text-bg-danger", items[0].GetProperty("badgeColor").GetString());
        }

        /// <summary>
        /// Verifies that a read narrowed by an id answers with the single filter
        /// in the record shape a form binds to, so an edit dialog can load it.
        /// </summary>
        [Fact]
        public void RetrieveSingle()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var quickfilter = new TestRestApiQuickfilterWritable();
            quickfilter.Create(CreateWriteRequest("POST", @"{""name"":""Mine"",""color"":""#7c3aed"",""criteria"":""author:me""}"));
            var id = quickfilter.LastCreatedId;

            // act
            var result = quickfilter.Retrieve(CreateReadRequest(id));

            // validation
            Assert.Equal(200, result.Status);

            var json = Encoding.UTF8.GetString((byte[])result.Content);
            using var doc = JsonDocument.Parse(json);
            var data = doc.RootElement.GetProperty("data");

            // the record carries what a write takes back, so the dialog reads
            // exactly what it will send
            Assert.Equal(id, data.GetProperty("id").GetString());
            Assert.Equal("Mine", data.GetProperty("name").GetString());
            Assert.Equal("#7c3aed", data.GetProperty("color").GetString());
            Assert.Equal("author:me", data.GetProperty("criteria").GetString());
        }

        /// <summary>
        /// Verifies that a read of an unknown filter is answered as not found
        /// rather than with an empty form.
        /// </summary>
        [Fact]
        public void RetrieveSingleUnknown()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var quickfilter = new TestRestApiQuickfilterWritable();

            // act
            var result = quickfilter.Retrieve(CreateReadRequest("nope"));

            // validation
            Assert.Equal(404, result.Status);
        }

        /// <summary>
        /// Builds a read request narrowed to a single filter. The server derives
        /// the parameters from the uri, which the fixture does not, so the id is
        /// added directly.
        /// </summary>
        /// <param name="id">The id of the filter.</param>
        /// <returns>The request.</returns>
        private static IRequest CreateReadRequest(string id)
        {
            var request = UnitTestControlFixture.CreateRequestMock();
            request.AddParameter(new Parameter("id", id, ParameterScope.Parameter));

            return request;
        }

        /// <summary>
        /// Builds a request carrying the given json body, as the fixture expects
        /// a complete http message rather than a bare body.
        /// </summary>
        /// <param name="method">The request method.</param>
        /// <param name="body">The json body.</param>
        /// <returns>The request.</returns>
        private static IRequest CreateWriteRequest(string method, string body)
        {
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
        /// Verifies that a user-defined filter is created, that the endpoint owns
        /// the id and that the criteria travel through unchanged.
        /// </summary>
        [Fact]
        public void Create()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var quickfilter = new TestRestApiQuickfilterWritable();
            var request = CreateWriteRequest("POST", @"{""name"":""Mine"",""color"":""#7c3aed"",""criteria"":""author:me""}");

            // act
            var result = quickfilter.Create(request);

            // validation
            Assert.Equal(200, result.Status);

            var json = Encoding.UTF8.GetString((byte[])result.Content);
            using var doc = JsonDocument.Parse(json);
            var item = doc.RootElement.GetProperty("filters").EnumerateArray().Single();

            Assert.Equal(quickfilter.LastCreatedId, item.GetProperty("id").GetString());
            Assert.Equal("Mine", item.GetProperty("name").GetString());
            Assert.Equal("author:me", item.GetProperty("criteria").GetString());
            Assert.True(item.GetProperty("custom").GetBoolean());

            // a user-picked color has no button class and travels as a raw value
            Assert.Equal("#7c3aed", item.GetProperty("colorValue").GetString());
        }

        /// <summary>
        /// Verifies that a user-defined filter is changed and returned in its
        /// updated shape, so the client can adopt it without reloading.
        /// </summary>
        [Fact]
        public void Update()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var quickfilter = new TestRestApiQuickfilterWritable();
            quickfilter.Create(CreateWriteRequest("POST", @"{""name"":""Mine""}"));
            var id = quickfilter.LastCreatedId;

            // act
            var result = quickfilter.Update(CreateWriteRequest("PUT", $@"{{""id"":""{id}"",""name"":""Renamed"",""criteria"":""state:open""}}"));

            // validation
            Assert.Equal(200, result.Status);

            var json = Encoding.UTF8.GetString((byte[])result.Content);
            using var doc = JsonDocument.Parse(json);
            var item = doc.RootElement.GetProperty("filters").EnumerateArray().Single();

            Assert.Equal("Renamed", item.GetProperty("name").GetString());
            Assert.Equal("state:open", item.GetProperty("criteria").GetString());
        }

        /// <summary>
        /// Verifies that a user-defined filter is removed.
        /// </summary>
        [Fact]
        public void Delete()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var quickfilter = new TestRestApiQuickfilterWritable();
            quickfilter.Create(CreateWriteRequest("POST", @"{""name"":""Mine""}"));
            var id = quickfilter.LastCreatedId;

            // act
            var result = quickfilter.Delete(CreateWriteRequest("DELETE", $@"{{""id"":""{id}""}}"));

            // validation
            Assert.Equal(204, result.Status);
            Assert.Empty(quickfilter.Filters);
        }

        /// <summary>
        /// Verifies that an endpoint which does not opt into user-defined filters
        /// rejects a write instead of silently accepting it.
        /// </summary>
        [Fact]
        public void CreateOnReadOnlyEndpoint()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var quickfilter = new TestRestApiQuickfilter([]);

            // act
            var result = quickfilter.Create(CreateWriteRequest("POST", @"{""name"":""Mine""}"));

            // validation
            Assert.Equal(501, result.Status);
        }

        /// <summary>
        /// Verifies that a write without a body is rejected.
        /// </summary>
        [Fact]
        public void CreateWithoutBody()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var quickfilter = new TestRestApiQuickfilterWritable();

            // act
            var result = quickfilter.Create(UnitTestControlFixture.CreateRequestMock());

            // validation
            Assert.Equal(400, result.Status);
        }
    }
}
