using System.Globalization;
using WebExpress.WebApp.WebAttribute;

namespace WebExpress.WebApp.Test.WebAttribute
{
    /// <summary>
    /// Unit tests for the contains validation attribute.
    /// Ensures that strings not containing the substring are rejected.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestValidationContains
    {
        /// <summary>
        /// Tests contains validation with different substrings.
        /// </summary>
        [Theory]
        [InlineData("middle", "mid", true)]
        [InlineData("xyz", "mid", false)]
        public void IsValid(string value, string substring, bool expected)
        {
            // preconditions
            var attr = new ValidateContainsAttribute(substring, "invalid");

            // test execution
            var result = attr.IsValid(value, CultureInfo.InvariantCulture, out var error);

            // validation
            Assert.Equal(expected, result);
            Assert.Equal(expected ? string.Empty : "invalid", error);
        }
    }
}
