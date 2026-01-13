using System.Globalization;
using WebExpress.WebApp.WebAttribute;

namespace WebExpress.WebApp.Test.WebAttribute
{
    /// <summary>
    /// Unit tests for the ends with validation attribute.
    /// Ensures that strings not ending with the suffix are rejected.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestValidationEndsWith
    {
        /// <summary>
        /// Tests ends-with validation with different suffixes.
        /// </summary>
        [Theory]
        [InlineData("theend", "end", true)]
        [InlineData("start", "end", false)]
        public void IsValid(string value, string suffix, bool expected)
        {
            // preconditions
            var attr = new ValidateEndsWithAttribute(suffix, "invalid");

            // test execution
            var result = attr.IsValid(value, CultureInfo.InvariantCulture, out var error);

            // validation
            Assert.Equal(expected, result);
            Assert.Equal(expected ? string.Empty : "invalid", error);
        }
    }
}
