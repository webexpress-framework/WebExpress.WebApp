using System.Globalization;
using WebExpress.WebApp.WebAttribute;

namespace WebExpress.WebApp.Test.WebAttribute
{
    /// <summary>
    /// Unit tests for the starts with validation attribute.
    /// Ensures that strings not starting with the prefix are rejected.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestValidationStartsWith
    {
        /// <summary>
        /// Tests starts-with validation with different prefixes.
        /// </summary>
        [Theory]
        [InlineData("prefix", "pre", true)]
        [InlineData("xyz", "pre", false)]
        public void IsValid(string value, string prefix, bool expected)
        {
            // preconditions
            var attr = new ValidateStartsWithAttribute(prefix, "invalid");

            // test execution
            var result = attr.IsValid(value, CultureInfo.InvariantCulture, out var error);

            // validation
            Assert.Equal(expected, result);
            Assert.Equal(expected ? string.Empty : "invalid", error);
        }
    }
}
