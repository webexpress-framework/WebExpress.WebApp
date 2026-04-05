using System.Globalization;
using WebExpress.WebApp.WebAttribute;

namespace WebExpress.WebApp.Test.WebAttribute
{
    /// <summary>
    /// Unit tests for the max length validation attribute.
    /// Ensures that strings exceeding the maximum length are rejected.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestValidationMaxLength
    {
        /// <summary>
        /// Tests maximum length validation with different string lengths.
        /// </summary>
        [Theory]
        [InlineData("abc", 5, true)]
        [InlineData("abc", 3, true)]
        [InlineData("abcd", 3, false)]
        public void IsValid(string value, int max, bool expected)
        {
            // arrange
            var attr = new ValidateMaxLengthAttribute(max, "too long");

            // act
            var result = attr.IsValid(value, CultureInfo.InvariantCulture, out var error);

            // validation
            Assert.Equal(expected, result);
            Assert.Equal(expected ? string.Empty : "too long", error);
        }
    }
}
