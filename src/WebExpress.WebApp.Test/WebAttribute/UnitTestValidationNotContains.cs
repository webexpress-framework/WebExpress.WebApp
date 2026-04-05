using System.Globalization;
using WebExpress.WebApp.WebAttribute;

namespace WebExpress.WebApp.Test.WebAttribute
{
    /// <summary>
    /// Unit tests for the not contains validation attribute.
    /// Ensures that strings containing the forbidden substring are rejected.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestValidationNotContains
    {
        /// <summary>
        /// Tests not-contains validation with different substrings.
        /// </summary>
        [Theory]
        [InlineData("hello", "bad", true)]
        [InlineData("badword", "bad", false)]
        public void IsValid(string value, string substring, bool expected)
        {
            // arrange
            var attr = new ValidateNotContainsAttribute(substring, "invalid");

            // act
            var result = attr.IsValid(value, CultureInfo.InvariantCulture, out var error);

            // validation
            Assert.Equal(expected, result);
            Assert.Equal(expected ? string.Empty : "invalid", error);
        }
    }
}
