using System.Globalization;
using WebExpress.WebApp.WebAttribute;

namespace WebExpress.WebApp.Test.WebAttribute
{
    /// <summary>
    /// Unit tests for the email validation attribute.
    /// Ensures that invalid email formats are rejected.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestValidationEmail
    {
        /// <summary>
        /// Tests email validation with valid and invalid email strings.
        /// </summary>
        [Theory]
        [InlineData("test@example.com", true)]
        [InlineData("invalid", false)]
        [InlineData("a@b", false)]
        public void IsValid(string value, bool expected)
        {
            // arrange
            var attr = new ValidateEmailAttribute("invalid email");

            // act
            var result = attr.IsValid(value, CultureInfo.InvariantCulture, out var error);

            // validation
            Assert.Equal(expected, result);
            Assert.Equal(expected ? string.Empty : "invalid email", error);
        }
    }
}
