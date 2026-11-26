using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebPage;
using WebExpress.WebApp.WebRestApi;
using WebExpress.WebCore.WebEndpoint;
using WebExpress.WebCore.WebPolicies;

namespace WebExpress.WebApp.Test.WebPage
{
    /// <summary>
    /// Tests which endpoints of the template answer callers who are not signed in. An endpoint
    /// without a policy requires a signed-in caller, so the login, the api it signs in through
    /// and the message queue every page connects to say that they are public.
    /// </summary>
    public class UnitTestPublicEndpoints
    {
        /// <summary>
        /// Verifies that the login page, the logout page and the login api are public, inherited
        /// by the classes an application derives from them.
        /// </summary>
        [Fact]
        public void LoginIsPublic()
        {
            Assert.True(typeof(IPublicEndpoint).IsAssignableFrom(typeof(PageWebAppLogin)));
            Assert.True(typeof(IPublicEndpoint).IsAssignableFrom(typeof(PageWebAppLogout)));
            Assert.True(typeof(IPublicEndpoint).IsAssignableFrom(typeof(RestApiSession)));
        }

        /// <summary>
        /// Verifies that the server admits the handshake of the message queue without an
        /// identity. Every page connects to it, those that work without signing in included, and
        /// retries a refused handshake for as long as it stays open. Chat, broadcasts and metrics
        /// are withheld from such a connection per message instead.
        /// </summary>
        [Fact]
        public void MessageQueueIsPublic()
        {
            // arrange
            var hub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = hub.ApplicationManager.GetApplications(typeof(TestApplication)).First();

            // act
            var socket = Assert.Single(hub.EndpointManager.GetEndpoints(typeof(WWW.Ws.MessageQueue), application));

            // validation
            Assert.Contains(socket.Policies, x => x is PublicAccessPolicy);
            Assert.True(hub.IdentityManager.CheckAccess(null, socket));
        }
    }
}
