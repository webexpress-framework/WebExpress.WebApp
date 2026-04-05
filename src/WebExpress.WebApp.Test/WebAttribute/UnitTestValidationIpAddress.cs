using System.Globalization;
using WebExpress.WebApp.WebAttribute;

namespace WebExpress.WebApp.Test.WebAttribute
{
    /// <summary>
    /// Unit tests for the IP address validation attribute.
    /// Ensures that invalid IPv4 and IPv6 addresses are rejected.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestValidationIpAddress
    {
        /// <summary>
        /// Tests IP address validation with valid and invalid inputs.
        /// </summary>
        /// <param name="value">The IP address string to validate.</param>
        /// <param name="expected">The expected validation result.</param>
        [Theory]
        [InlineData("127.0.0.1", true)]
        [InlineData("192.168.1.1", true)]
        [InlineData("::1", true)]
        [InlineData("256.256.256.256", false)]
        [InlineData("not-an-ip", false)]
        [InlineData("", false)]
        public void IsValid(string value, bool expected)
        {
            // arrange
            var attr = new ValidateIpAddressAttribute("invalid ip");

            // act
            var result = attr.IsValid(value, CultureInfo.InvariantCulture, out var error);

            // validation
            Assert.Equal(expected, result);
            Assert.Equal(expected ? string.Empty : "invalid ip", error);
        }
    }
}
