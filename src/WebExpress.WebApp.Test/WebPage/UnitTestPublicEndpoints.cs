using WebExpress.WebApp.WebPage;
using WebExpress.WebApp.WebRestApi;
using WebExpress.WebCore.WebEndpoint;

namespace WebExpress.WebApp.Test.WebPage
{
    /// <summary>
    /// Tests which endpoints of the template answer callers who are not signed in. An endpoint
    /// without a policy requires a signed-in caller, so the login and the api it signs in through
    /// say that they are public, and nothing else does.
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
        /// Verifies that the message queue socket is not public: it carries chat, notifications
        /// and system metrics and was reachable by anybody before.
        /// </summary>
        [Fact]
        public void MessageQueueIsNotPublic()
        {
            Assert.False(typeof(IPublicEndpoint).IsAssignableFrom(typeof(WWW.Ws.MessageQueue)));
        }
    }
}
