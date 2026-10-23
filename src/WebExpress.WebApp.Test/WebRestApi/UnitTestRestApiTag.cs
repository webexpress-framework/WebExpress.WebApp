using System.Collections.Generic;
using System.Text;
using System.Text.Json;
using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebRestApi;
using WebExpress.WebCore.WebParameter;

namespace WebExpress.WebApp.Test.WebRestApi
{
    /// <summary>
    /// Provides unit tests for verifying the behavior of the
    /// <see cref="RestApiTag"/> abstract endpoint, exercised through the
    /// in-memory <see cref="TestRestApiTag"/> implementation.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestRestApiTag
    {
        /// <summary>
        /// Verifies that <c>GET</c> without a query returns the seeded tags.
        /// </summary>
        [Fact]
        public void Retrieve_ReturnsSeededTags()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var seed = new List<RestApiTagItem>
            {
                new() { Value = "alpha" },
                new() { Value = "beta" }
            };
            var api = new TestRestApiTag(seed);
            var request = UnitTestControlFixture.CreateRequestMock("", "https://example.com/");

            // act
            var result = api.Retrieve(request);

            // validation
            Assert.NotNull(result);
            Assert.Equal(200, result.Status);

            var json = Encoding.UTF8.GetString((byte[])result.Content);
            using var doc = JsonDocument.Parse(json);
            var items = doc.RootElement.EnumerateArray().ToList();
            Assert.Equal(2, items.Count);
            Assert.Equal("alpha", items[0].GetProperty("value").GetString());
            Assert.Equal("beta", items[1].GetProperty("value").GetString());
        }

        /// <summary>
        /// Verifies that <c>GET</c> with a <c>q</c> query returns the matching
        /// vocabulary suggestions instead of the attached tags.
        /// </summary>
        [Fact]
        public void Retrieve_WithQuery_ReturnsSuggestions()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var seed = new List<RestApiTagItem> { new() { Value = "attached" } };
            var vocabulary = new List<RestApiTagItem>
            {
                new() { Value = "alpha" },
                new() { Value = "beta" },
                new() { Value = "alfa" }
            };
            var api = new TestRestApiTag(seed, vocabulary);
            var request = UnitTestControlFixture.CreateRequestMock("", "https://example.com/");
            request.AddParameter(new Parameter("q", "al", ParameterScope.Parameter));

            // act
            var result = api.Retrieve(request);

            // validation
            Assert.NotNull(result);
            Assert.Equal(200, result.Status);

            var json = Encoding.UTF8.GetString((byte[])result.Content);
            using var doc = JsonDocument.Parse(json);
            var values = doc.RootElement.EnumerateArray().Select(x => x.GetProperty("value").GetString()).ToList();
            Assert.Equal(2, values.Count);
            Assert.Contains("alpha", values);
            Assert.Contains("alfa", values);
            Assert.DoesNotContain("beta", values);
            Assert.DoesNotContain("attached", values);
        }

        /// <summary>
        /// Verifies that <c>POST</c> creates a new tag from the JSON body and
        /// returns the persisted item.
        /// </summary>
        [Fact]
        public void Create_PersistsTag()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiTag();
            var request = UnitTestControlFixture.CreateRequestMock
            (
                "POST / HTTP/1.1\r\n" +
                "Host: localhost\r\n" +
                "Content-Type: application/json\r\n" +
                "\r\n" +
                "{\"value\":\"urgent\"}",
                "https://example.com/"
            );

            // act
            var result = api.Create(request);

            // validation
            Assert.NotNull(result);
            Assert.Equal(200, result.Status);

            var json = Encoding.UTF8.GetString((byte[])result.Content);
            using var doc = JsonDocument.Parse(json);
            Assert.Equal("urgent", doc.RootElement.GetProperty("value").GetString());

            Assert.Single(api.Tags);
            Assert.Equal("urgent", api.Tags[0].Value);
        }

        /// <summary>
        /// Verifies that an empty payload yields a 400 response.
        /// </summary>
        [Fact]
        public void Create_EmptyPayload_BadRequest()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiTag();
            var request = UnitTestControlFixture.CreateRequestMock
            (
                "POST / HTTP/1.1\r\n" +
                "Host: localhost\r\n" +
                "Content-Type: application/json\r\n" +
                "\r\n" +
                "{\"value\":\"\"}",
                "https://example.com/"
            );

            // act
            var result = api.Create(request);

            // validation
            Assert.NotNull(result);
            Assert.Equal(400, result.Status);
            Assert.Empty(api.Tags);
        }

        /// <summary>
        /// Verifies that posting an already existing tag does not create a
        /// duplicate.
        /// </summary>
        [Fact]
        public void Create_Duplicate_DoesNotDuplicate()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiTag(new List<RestApiTagItem> { new() { Value = "alpha" } });
            var request = UnitTestControlFixture.CreateRequestMock
            (
                "POST / HTTP/1.1\r\n" +
                "Host: localhost\r\n" +
                "Content-Type: application/json\r\n" +
                "\r\n" +
                "{\"value\":\"alpha\"}",
                "https://example.com/"
            );

            // act
            var result = api.Create(request);

            // validation
            Assert.Equal(200, result.Status);
            Assert.Single(api.Tags);
        }

        /// <summary>
        /// Verifies that <c>DELETE {value}</c> removes the matching tag.
        /// </summary>
        [Fact]
        public void Delete_RemovesTag()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiTag(new List<RestApiTagItem> { new() { Value = "alpha" } });
            var request = UnitTestControlFixture.CreateRequestMock("", "https://example.com/alpha");

            // act
            var result = api.Delete(request);

            // validation
            Assert.NotNull(result);
            Assert.Equal(204, result.Status);
            Assert.Empty(api.Tags);
        }

        /// <summary>
        /// Verifies that <c>DELETE</c> against an unknown value yields 404.
        /// </summary>
        [Fact]
        public void Delete_Missing_NotFound()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiTag(new List<RestApiTagItem> { new() { Value = "alpha" } });
            var request = UnitTestControlFixture.CreateRequestMock("", "https://example.com/missing");

            // act
            var result = api.Delete(request);

            // validation
            Assert.NotNull(result);
            Assert.Equal(404, result.Status);
            Assert.Single(api.Tags);
        }
    }
}
