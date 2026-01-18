using System.Globalization;
using WebExpress.WebApp.WebAttribute;

namespace WebExpress.WebApp.Test.WebAttribute
{
    /// <summary>
    /// Unit tests for the future date validation attribute.
    /// Ensures that past dates are rejected.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestValidationFutureDate
    {
        /// <summary>
        /// Tests future-date validation using date offsets.
        /// </summary>
        [Theory]
        [InlineData(1, true)]
        [InlineData(-1, false)]
        public void IsValid(int offsetDays, bool expected)
        {
            // arrange
            var attr = new ValidateFutureDateAttribute("not future");
            var date = DateTime.UtcNow.AddDays(offsetDays);

            // act
            var result = attr.IsValid(date, CultureInfo.InvariantCulture, out var error);

            // validation
            Assert.Equal(expected, result);
            Assert.Equal(expected ? string.Empty : "not future", error);
        }
    }
}
