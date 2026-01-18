using System.Globalization;
using WebExpress.WebApp.WebAttribute;

namespace WebExpress.WebApp.Test.WebAttribute
{
    /// <summary>
    /// Unit tests for the range validation attribute.
    /// Ensures that numeric values outside the allowed range are rejected.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestValidationRange
    {
        /// <summary>
        /// Tests numeric range validation with different values.
        /// </summary>
        [Theory]
        [InlineData(5, 1, 10, true)]
        [InlineData(1, 1, 10, true)]
        [InlineData(10, 1, 10, true)]
        [InlineData(0, 1, 10, false)]
        [InlineData(20, 1, 10, false)]
        public void IsValid(double value, double min, double max, bool expected)
        {
            // arrange
            var attr = new ValidateRangeAttribute(min, max, "out of range");

            // act
            var result = attr.IsValid(value, CultureInfo.InvariantCulture, out var error);

            // validation
            Assert.Equal(expected, result);
            Assert.Equal(expected ? string.Empty : "out of range", error);
        }
    }
}
