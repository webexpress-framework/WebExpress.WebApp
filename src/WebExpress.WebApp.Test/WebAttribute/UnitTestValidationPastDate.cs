using System.Globalization;
using WebExpress.WebApp.WebAttribute;

namespace WebExpress.WebApp.Test.WebAttribute
{
    /// <summary>
    /// Unit tests for the past date validation attribute.
    /// Ensures that future dates are rejected.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestValidationPastDate
    {
        /// <summary>
        /// Tests past-date validation using date offsets.
        /// </summary>
        [Theory]
        [InlineData(-1, true)]
        [InlineData(1, false)]
        public void IsValid(int offsetDays, bool expected)
        {
            // preconditions
            var attr = new ValidatePastDateAttribute("not past");
            var date = DateTime.UtcNow.AddDays(offsetDays);

            // test execution
            var result = attr.IsValid(date, CultureInfo.InvariantCulture, out var error);

            // validation
            Assert.Equal(expected, result);
            Assert.Equal(expected ? string.Empty : "not past", error);
        }
    }
}
