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
