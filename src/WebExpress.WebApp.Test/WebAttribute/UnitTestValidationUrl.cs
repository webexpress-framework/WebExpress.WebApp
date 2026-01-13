using System.Globalization;
using WebExpress.WebApp.WebAttribute;

namespace WebExpress.WebApp.Test.WebAttribute
{
    /// <summary>
    /// Unit tests for the url validation attribute.
    /// Ensures that invalid URLs are rejected.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestValidationUrl
    {
        /// <summary>
        /// Tests URL validation with valid and invalid URLs.
        /// </summary>
        [Theory]
        [InlineData("https://example.com", true)]
        [InlineData("http://localhost", true)]
        [InlineData("not-a-url", false)]
        public void IsValid(string value, bool expected)
        {
            // preconditions
            var attr = new ValidateUrlAttribute("invalid url");

            // test execution
            var result = attr.IsValid(value, CultureInfo.InvariantCulture, out var error);

            // validation
            Assert.Equal(expected, result);
            Assert.Equal(expected ? string.Empty : "invalid url", error);
        }
    }
}
