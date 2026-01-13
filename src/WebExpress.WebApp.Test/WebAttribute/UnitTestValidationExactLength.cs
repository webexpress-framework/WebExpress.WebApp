using System.Globalization;
using WebExpress.WebApp.WebAttribute;

namespace WebExpress.WebApp.Test.WebAttribute
{
    /// <summary>
    /// Unit tests for the exact length validation attribute.
    /// Ensures that strings not matching the exact length are rejected.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestValidationExactLength
    {
        /// <summary>
        /// Tests exact-length validation with different string lengths.
        /// </summary>
        [Theory]
        [InlineData("test", 4, true)]
        [InlineData("abc", 4, false)]
        public void IsValid(string value, int length, bool expected)
        {
            // preconditions
            var attr = new ValidateExactLengthAttribute(length, "invalid");

            // test execution
            var result = attr.IsValid(value, CultureInfo.InvariantCulture, out var error);

            // validation
            Assert.Equal(expected, result);
            Assert.Equal(expected ? string.Empty : "invalid", error);
        }
    }
}
