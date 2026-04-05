using System.Globalization;
using WebExpress.WebApp.WebAttribute;

namespace WebExpress.WebApp.Test.WebAttribute
{
    /// <summary>
    /// Unit tests for the date range validation attribute.
    /// Ensures that dates outside the allowed range are rejected.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestValidationDateRange
    {
        /// <summary>
        /// Tests date range validation with different date inputs.
        /// </summary>
        /// <param name="dateString">The date to validate.</param>
        /// <param name="expected">The expected validation result.</param>
        [Theory]
        [InlineData("2025-01-01", true)]
        [InlineData("2010-01-01", false)]
        [InlineData("2040-01-01", false)]
        public void IsValid(string dateString, bool expected)
        {
            // arrange
            var attr = new ValidateDateRangeAttribute(
                message: "invalid",
                min: "2020-01-01",
                max: "2030-01-01"
            );

            var date = DateTime.Parse(dateString);

            // act
            var result = attr.IsValid(date, CultureInfo.InvariantCulture, out var error);

            // validation
            Assert.Equal(expected, result);
            Assert.Equal(expected ? string.Empty : "invalid", error);
        }
    }
}
