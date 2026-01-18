using System.Globalization;
using WebExpress.WebApp.WebAttribute;

namespace WebExpress.WebApp.Test.WebAttribute
{
    /// <summary>
    /// Unit tests for the allowed values validation attribute.
    /// Ensures that values outside the allowed set are rejected.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestValidationAllowedValues
    {
        /// <summary>
        /// Tests allowed-values validation with different inputs.
        /// </summary>
        [Theory]
        [InlineData(1, true)]
        [InlineData(2, true)]
        [InlineData(3, true)]
        [InlineData(5, false)]
        public void IsValid(int value, bool expected)
        {
            // arrange
            var attr = new ValidateAllowedValuesAttribute("not allowed", 1, 2, 3);

            // act
            var result = attr.IsValid(value, CultureInfo.InvariantCulture, out var error);

            // validation
            Assert.Equal(expected, result);
            Assert.Equal(expected ? string.Empty : "not allowed", error);
        }
    }
}
