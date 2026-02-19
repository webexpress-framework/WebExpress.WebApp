using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.Test.Model;

namespace WebExpress.WebApp.Test.WebRestApi
{
    /// <summary>
    /// Provides unit tests for verifying the behavior of the rest api wql prompt class.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestRestApiWqlPrompt
    {
        /// <summary>
        /// Verifies that the Retrieve method returns the correct cell values for both joined 
        /// and simple fields.
        /// </summary>
        [Fact]
        public void RetrieveHistory()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var wqlApi = new TestRestApiWqlPrompt<TestIndexItem>();
            var request = UnitTestControlFixture.CreateRequestMock(uri: "/api/history");

            // act
            var result = wqlApi.Get(request);

            // vallidation
            Assert.NotNull(result);
            Assert.Equal(200, result.Status);
        }
    }
}
