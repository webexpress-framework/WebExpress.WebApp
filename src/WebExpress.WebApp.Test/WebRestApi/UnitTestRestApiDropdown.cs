using System.Text;
using System.Text.Json;
using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.Test.Model;

namespace WebExpress.WebApp.Test.WebRestApi
{
    /// <summary>
    /// Provides unit tests for verifying the behavior of the RestApiDropdown class.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestRestApiDropdown
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
            var dropdown = new TestRestApiDropdown([item]);
            var request = UnitTestControlFixture.CreateRequestMock();

            // act
            var result = dropdown.Retrieve(request);

            // vallidation
            Assert.NotNull(result);
            Assert.Equal(200, result.Status);

            var json = Encoding.UTF8.GetString((byte[])result.Content);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            var items = root.GetProperty("items").EnumerateArray().ToList();
            Assert.Single(items);

            Assert.NotEmpty(items[0].GetProperty("text").GetString());
            Assert.Null(items[0].GetProperty("icon").GetString());

            Assert.True(items[0].TryGetProperty("icon", out var iconElement) && iconElement.ValueKind == JsonValueKind.Null);
            Assert.True(items[0].TryGetProperty("image", out var imageElement) && imageElement.ValueKind == JsonValueKind.Null);
            Assert.True(items[0].TryGetProperty("uri", out var uriElement) && uriElement.ValueKind == JsonValueKind.Null);
        }
    }
}
