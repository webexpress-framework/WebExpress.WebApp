using System.Globalization;
using WebExpress.WebApp.WebAttribute;

namespace WebExpress.WebApp.Test.WebAttribute
{
    /// <summary>
    /// Unit tests for the maximum items validation attribute.
    /// Ensures that collections exceeding the maximum size are rejected.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestValidationMaxItems
    {
        /// <summary>
        /// Tests maximum item validation with different collection sizes.
        /// </summary>
        /// <param name="count">The number of items in the test collection.</param>
        /// <param name="expected">The expected validation result.</param>
        [Theory]
        [InlineData(1, true)]
        [InlineData(2, true)]
        [InlineData(3, false)]
        public void IsValid(int count, bool expected)
        {
            // preconditions
            var attr = new ValidateMaxItemsAttribute(2, "too many");

            var list = new List<int>();
            for (int i = 0; i < count; i++)
            {
                list.Add(i);
            }

            // test execution
            var result = attr.IsValid(list, CultureInfo.InvariantCulture, out var error);

            // validation
            Assert.Equal(expected, result);
            Assert.Equal(expected ? string.Empty : "too many", error);
        }
    }
}
