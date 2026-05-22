using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebRestApi;
using WebExpress.WebCore.WebParameter;

namespace WebExpress.WebApp.Test.WebRestApi
{
    /// <summary>
    /// Provides unit tests for verifying the behavior of
    /// <see cref="RestApiParameterExtensions.ParseIntParameter"/>.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestRestApiParameterExtensions
    {
        /// <summary>
        /// Verifies that the default value is returned when the parameter is missing.
        /// </summary>
        [Fact]
        public void ParseIntParameter_ReturnsDefault_WhenParameterMissing()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var request = UnitTestControlFixture.CreateRequestMock();

            // act
            var actual = request.ParseIntParameter("missing", 42);

            // validation
            Assert.Equal(42, actual);
        }

        /// <summary>
        /// Verifies that non-numeric input does not throw FormatException but falls back to the default.
        /// </summary>
        [Fact]
        public void ParseIntParameter_ReturnsDefault_WhenValueNotNumeric()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var request = UnitTestControlFixture.CreateRequestMock();
            request.AddParameter(new Parameter("p", "notanumber", ParameterScope.Parameter));

            // act
            var actual = request.ParseIntParameter("p", 7);

            // validation
            Assert.Equal(7, actual);
        }

        /// <summary>
        /// Verifies that a numeric input is parsed correctly.
        /// </summary>
        [Fact]
        public void ParseIntParameter_ReturnsParsed_WhenValueNumeric()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var request = UnitTestControlFixture.CreateRequestMock();
            request.AddParameter(new Parameter("p", "15", ParameterScope.Parameter));

            // act
            var actual = request.ParseIntParameter("p", 0);

            // validation
            Assert.Equal(15, actual);
        }

        /// <summary>
        /// Verifies that an empty value falls back to the default.
        /// </summary>
        [Fact]
        public void ParseIntParameter_ReturnsDefault_WhenValueEmpty()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var request = UnitTestControlFixture.CreateRequestMock();
            request.AddParameter(new Parameter("p", string.Empty, ParameterScope.Parameter));

            // act
            var actual = request.ParseIntParameter("p", 99);

            // validation
            Assert.Equal(99, actual);
        }
    }
}
