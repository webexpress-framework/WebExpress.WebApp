using System.Text;
using System.Text.Json;
using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.Test.Model;

namespace WebExpress.WebApp.Test.WebRestApi
{
    /// <summary>
    /// Provides unit tests for verifying the behavior of the RestApiAvatarDropdown class.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestRestApiAvatarDropdown
    {
        /// <summary>
        /// Verifies that the Retrieve method returns the correct avatar dropdown items
        /// including the section property.
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
            var dropdown = new TestRestApiAvatarDropdown([item]);
            var request = UnitTestControlFixture.CreateRequestMock();

            // act
            var result = dropdown.Retrieve(request);

            // validation
            Assert.NotNull(result);
            Assert.Equal(200, result.Status);

            var json = Encoding.UTF8.GetString((byte[])result.Content);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            var items = root.GetProperty("items").EnumerateArray().ToList();
            Assert.Single(items);

            Assert.NotEmpty(items[0].GetProperty("text").GetString());
            Assert.Equal("primary", items[0].GetProperty("section").GetString());
            Assert.Null(items[0].GetProperty("icon").GetString());

            Assert.True(items[0].TryGetProperty("icon", out var iconElement) && iconElement.ValueKind == JsonValueKind.Null);
            Assert.True(items[0].TryGetProperty("image", out var imageElement) && imageElement.ValueKind == JsonValueKind.Null);
            Assert.True(items[0].TryGetProperty("uri", out var uriElement) && uriElement.ValueKind == JsonValueKind.Null);
        }

        /// <summary>
        /// Verifies that the Retrieve method returns multiple items correctly.
        /// </summary>
        [Fact]
        public void RetrieveMultiple()
        {
            // arrange
            var item1 = new TestIndexItem
            {
                Id = Guid.NewGuid(),
                Key = "A1",
                Names = ["Anna"],
                State = "Active",
                Description = "Profile"
            };
            var item2 = new TestIndexItem
            {
                Id = Guid.NewGuid(),
                Key = "A2",
                Names = ["Bob"],
                State = "Active",
                Description = "Logout"
            };
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var dropdown = new TestRestApiAvatarDropdown([item1, item2]);
            var request = UnitTestControlFixture.CreateRequestMock();

            // act
            var result = dropdown.Retrieve(request);

            // validation
            Assert.NotNull(result);
            Assert.Equal(200, result.Status);

            var json = Encoding.UTF8.GetString((byte[])result.Content);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            var items = root.GetProperty("items").EnumerateArray().ToList();
            Assert.Equal(2, items.Count);
        }

        /// <summary>
        /// Verifies that the Retrieve method returns an empty list when no items match.
        /// </summary>
        [Fact]
        public void RetrieveEmpty()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var dropdown = new TestRestApiAvatarDropdown([]);
            var request = UnitTestControlFixture.CreateRequestMock();

            // act
            var result = dropdown.Retrieve(request);

            // validation
            Assert.NotNull(result);
            Assert.Equal(200, result.Status);

            var json = Encoding.UTF8.GetString((byte[])result.Content);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            var items = root.GetProperty("items").EnumerateArray().ToList();
            Assert.Empty(items);
        }
    }
}
