using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebIdentity;
using WebExpress.WebCore.WebIdentity;

namespace WebExpress.WebApp.Test.WebIdentity
{
    /// <summary>
    /// Tests the abstract identity provider base class.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestIdentityProvider
    {
        /// <summary>
        /// A minimal concrete implementation for testing.
        /// </summary>
        private sealed class TestIdentityProvider : IdentityProvider
        {
            public bool ValidateBasicCalled { get; private set; }
            public bool ValidateTokenCalled { get; private set; }
            public string LastUsername { get; private set; }
            public string LastToken { get; private set; }
            public IIdentity IdentityToReturn { get; set; }

            public override IEnumerable<IIdentity> GetIdentities() => [];

            public override IEnumerable<IIdentityGroup> GetGroups() => [];

            protected override IIdentity ValidateBasicCredentials(string username, string password)
            {
                ValidateBasicCalled = true;
                LastUsername = username;
                return IdentityToReturn;
            }

            protected override IIdentity ValidateToken(string token)
            {
                ValidateTokenCalled = true;
                LastToken = token;
                return IdentityToReturn;
            }
        }

        /// <summary>
        /// Tests that Authenticate returns null when request is null.
        /// </summary>
        [Fact]
        public void Authenticate_NullRequest_ReturnsNull()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var provider = new TestIdentityProvider();

            // act
            var result = provider.Authenticate(null);

            // validation
            Assert.Null(result);
        }

        /// <summary>
        /// Tests that Authenticate returns null when the request has no authorization header.
        /// </summary>
        [Fact]
        public void Authenticate_NoAuthorizationHeader_ReturnsNull()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var provider = new TestIdentityProvider();
            var request = UnitTestControlFixture.CreateRequestMock();

            // act
            var result = provider.Authenticate(request);

            // validation
            Assert.Null(result);
        }

        /// <summary>
        /// Tests that Authenticate calls ValidateBasicCredentials for Basic auth headers.
        /// </summary>
        [Fact]
        public void Authenticate_BasicAuthHeader_CallsValidateBasicCredentials()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var provider = new TestIdentityProvider();
            var content = $"GET / HTTP/1.1\r\nHost: localhost\r\nAuthorization: Basic {Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes("user:pass"))}\r\n\r\n";
            var request = UnitTestControlFixture.CreateRequestMock(content, "");

            // act
            provider.Authenticate(request);

            // validation
            Assert.True(provider.ValidateBasicCalled);
        }

        /// <summary>
        /// Tests that Authenticate calls ValidateToken for Bearer auth headers.
        /// </summary>
        [Fact]
        public void Authenticate_BearerAuthHeader_CallsValidateToken()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var provider = new TestIdentityProvider();
            // bearer token must be base64-encoded as "<token>:" so Identification contains the token
            var bearerToken = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes("mytoken123:"));
            var content = $"GET / HTTP/1.1\r\nHost: localhost\r\nAuthorization: Bearer {bearerToken}\r\n\r\n";
            var request = UnitTestControlFixture.CreateRequestMock(content, "");

            // act
            provider.Authenticate(request);

            // validation
            Assert.True(provider.ValidateTokenCalled);
        }

        /// <summary>
        /// Tests that GetIdentities and GetGroups can be called on the provider.
        /// </summary>
        [Fact]
        public void GetIdentities_ReturnsEmpty()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var provider = new TestIdentityProvider();

            // act
            var identities = provider.GetIdentities();
            var groups = provider.GetGroups();

            // validation
            Assert.Empty(identities);
            Assert.Empty(groups);
        }
    }
}
