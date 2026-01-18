using System.Globalization;
using WebExpress.WebApp.WebAttribute;

namespace WebExpress.WebApp.Test.WebAttribute
{
    /// <summary>
    /// Unit tests for the not equal validation attribute.
    /// Ensures that a specific disallowed value is rejected.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestValidationNotEqual
    {
        /// <summary>
        /// Tests not-equal validation with different values.
        /// </summary>
        [Theory]
        [InlineData("x", false)]
        [InlineData("y", true)]
        [InlineData("", true)]
        public void IsValid(string value, bool expected)
        {
            // arrange
            var attr = new ValidateNotEqualAttribute("x", "must not be x");

            // act
            var result = attr.IsValid(value, CultureInfo.InvariantCulture, out var error);

            // validation
            Assert.Equal(expected, result);
            Assert.Equal(expected ? string.Empty : "must not be x", error);
        }
    }
}
