using System.Globalization;
using WebExpress.WebApp.WebAttribute;

namespace WebExpress.WebApp.Test.WebAttribute
{
    /// <summary>
    /// Unit tests for the min length validation attribute.
    /// Ensures that strings shorter than the minimum length are rejected.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestValidationMinLength
    {
        /// <summary>
        /// Tests minimum length validation with different string lengths.
        /// </summary>
        [Theory]
        [InlineData("abc", 2, true)]
        [InlineData("abc", 3, true)]
        [InlineData("abc", 4, false)]
        public void IsValid(string value, int min, bool expected)
        {
            // arrange
            var attr = new ValidateMinLengthAttribute(min, "too short");

            // act
            var result = attr.IsValid(value, CultureInfo.InvariantCulture, out var error);

            // validation
            Assert.Equal(expected, result);
            Assert.Equal(expected ? string.Empty : "too short", error);
        }
    }
}
