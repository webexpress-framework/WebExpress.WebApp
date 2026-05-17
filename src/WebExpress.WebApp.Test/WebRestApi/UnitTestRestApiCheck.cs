using System.Text;
using System.Text.Json;
using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebRestApi;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebParameter;

namespace WebExpress.WebApp.Test.WebRestApi
{
    /// <summary>
    /// Provides unit tests for verifying the behavior of the RestApiCheck class.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestRestApiCheck
    {
        /// <summary>
        /// Test subject that stores the checked state in-memory so the GET/POST
        /// round-trip can be verified without touching real persistence.
        /// </summary>
        private sealed class TestRestApiCheck : RestApiCheck
        {
            public bool State;
            public int GetCalls;
            public int SetCalls;

            protected override bool GetChecked(Request request)
            {
                GetCalls++;
                return State;
            }

            protected override void SetChecked(bool @checked, Request request)
            {
                SetCalls++;
                State = @checked;
            }
        }

        /// <summary>
        /// Verifies that the GET endpoint serializes the current state as JSON
        /// and that the abstract reader is consulted.
        /// </summary>
        [Theory]
        [InlineData(true)]
        [InlineData(false)]
        public void RetrieveReturnsCurrentState(bool state)
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiCheck { State = state };
            var request = (Request)UnitTestControlFixture.CreateRequestMock();

            // act
            var result = api.Retrieve(request);

            // validation
            Assert.NotNull(result);
            Assert.Equal(200, result.Status);
            Assert.Equal(1, api.GetCalls);

            var json = Encoding.UTF8.GetString((byte[])result.Content);
            using var doc = JsonDocument.Parse(json);
            Assert.Equal(state, doc.RootElement.GetProperty("checked").GetBoolean());
        }

        /// <summary>
        /// Verifies that the POST endpoint parses the <c>v</c> parameter,
        /// forwards the new state to the writer and echoes the resulting
        /// state in the response.
        /// </summary>
        [Theory]
        [InlineData("true", true)]
        [InlineData("True", true)]
        [InlineData("on", true)]
        [InlineData("1", true)]
        [InlineData("false", false)]
        [InlineData("0", false)]
        [InlineData("", false)]
        [InlineData(null, false)]
        public void UpdatePersistsAndEchoesState(string raw, bool expected)
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiCheck { State = !expected };
            var request = (Request)UnitTestControlFixture.CreateRequestMock();
            if (raw is not null)
            {
                request.AddParameter(new Parameter("v", raw, ParameterScope.Parameter));
            }

            // act
            var result = api.Update(request);

            // validation
            Assert.NotNull(result);
            Assert.Equal(200, result.Status);
            Assert.Equal(1, api.SetCalls);
            Assert.Equal(expected, api.State);

            var json = Encoding.UTF8.GetString((byte[])result.Content);
            using var doc = JsonDocument.Parse(json);
            Assert.Equal(expected, doc.RootElement.GetProperty("checked").GetBoolean());
        }
    }
}
