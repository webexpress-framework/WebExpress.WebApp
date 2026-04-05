using System.Globalization;
using WebExpress.WebApp.WebAttribute;

namespace WebExpress.WebApp.Test.WebAttribute
{
    /// <summary> 
    /// Unit tests for the required validation attribute. 
    /// Ensures that null, empty and whitespace values are rejected. 
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestValidationRequired
    {
        /// <summary> 
        /// Tests the required validation with different input values. 
        /// </summary> 
        /// <param name="value">The value to validate.</param> 
        /// <param name="expected">The expected validation result.</param>
        [Theory]
        [InlineData("hello", true)]
        [InlineData(" ", false)]
        [InlineData("", false)]
        [InlineData(null, false)]
        public void IsValid(object value, bool expected)
        {
            // arrange
            var attr = new ValidateRequiredAttribute("required");

            // act
            var result = attr.IsValid(value, CultureInfo.InvariantCulture, out var error);

            // validation
            Assert.Equal(expected, result);
            Assert.Equal(expected ? string.Empty : "required", error);
        }
    }
}
