using System.Globalization;
using WebExpress.WebApp.WebAttribute;

namespace WebExpress.WebApp.Test.WebAttribute
{
    /// <summary>
    /// Unit tests for the regex validation attribute.
    /// Ensures that strings not matching the pattern are rejected.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestValidationRegex
    {
        /// <summary>
        /// Tests regex validation with matching and non-matching values.
        /// </summary>
        [Theory]
        [InlineData("12345", true)]
        [InlineData("abc", false)]
        [InlineData("", false)]
        public void IsValid(string value, bool expected)
        {
            // arrange
            var attr = new ValidateRegexAttribute(@"^\d+$", "invalid");

            // act
            var result = attr.IsValid(value, CultureInfo.InvariantCulture, out var error);

            // validation
            Assert.Equal(expected, result);
            Assert.Equal(expected ? string.Empty : "invalid", error);
        }
    }
}
