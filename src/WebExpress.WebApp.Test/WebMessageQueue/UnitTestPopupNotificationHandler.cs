using System.Globalization;
using System.Net;
using System.Text.Json;
using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebMessageQueue;
using WebExpress.WebCore.WebApplication;
using WebExpress.WebCore.WebComponent;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebParameter;
using WebExpress.WebCore.WebPlugin;
using WebExpress.WebCore.WebSession.Model;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebNotification;

namespace WebExpress.WebApp.Test.WebMessageQueue
{
    /// <summary>
    /// Tests that a popup dismissed in the browser is removed on the server, so the next
    /// reconnect does not replay it.
    /// </summary>
    public class UnitTestPopupNotificationHandler
    {
        /// <summary>
        /// Tests that dismissing a notification of the session removes it from the session of
        /// the socket that sent the dismissal.
        /// </summary>
        [Fact]
        public async Task DismissRemovesSessionNotification()
        {
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).First();
            var request = (Request)UnitTestControlFixture.CreateRequestMock();
            var manager = componentHub.GetComponentManager<NotificationManager>();
            var created = manager.AddNotification(application, request, "saved");
            var handler = new PopupNotificationHandler(componentHub);

            await handler.HandleAsync(new FakeSocket(request.Session), Dismiss(created.Id), TestContext.Current.CancellationToken);

            Assert.Empty(manager.GetNotifications(application, request));
        }

        /// <summary>
        /// Tests that dismissing a global notification removes it.
        /// </summary>
        [Fact]
        public async Task DismissRemovesGlobalNotification()
        {
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).First();
            var request = (Request)UnitTestControlFixture.CreateRequestMock();
            var manager = componentHub.GetComponentManager<NotificationManager>();
            var created = manager.AddNotification(application, "maintenance");
            var handler = new PopupNotificationHandler(componentHub);

            await handler.HandleAsync(new FakeSocket(request.Session), Dismiss(created.Id), TestContext.Current.CancellationToken);

            Assert.Empty(manager.GetNotifications(application, request));
        }

        /// <summary>
        /// Builds the dismissal the browser sends.
        /// </summary>
        /// <param name="id">The notification id.</param>
        /// <returns>The payload.</returns>
        private static string Dismiss(Guid id)
        {
            return JsonSerializer.Serialize(new Dictionary<string, string>
            {
                ["type"] = PopupNotificationMessageTypes.Dismiss,
                ["notificationId"] = id.ToString()
            });
        }

        /// <summary>
        /// A socket that only carries its session.
        /// </summary>
        private sealed class FakeSocket(Session session) : IMessageQueueSocket
        {
            public IClientSession ClientSession { get; } = new FakeSession { Session = session };
            public Task OnConnectedAsync(WebCore.WebSocket.ISocketConnection socketConnection) => Task.CompletedTask;
            public Task SendAsync(IMessage message, CancellationToken cancellationToken = default) => Task.CompletedTask;
            public void Dispose() { }
        }

        /// <summary>
        /// A client session that only carries the server session.
        /// </summary>
        private sealed class FakeSession : IClientSession
        {
            public RequestMethod Method { get; set; }
            public IUri Uri { get; set; }
            public Session Session { get; set; }
            public RequestHeaderFields Header { get; set; }
            public EndPoint RemoteEndPoint { get; set; }
            public CultureInfo Culture { get; set; }
            public IEnumerable<IParameter> Parameters { get; set; } = [];
            public string SupportedSubProtocol { get; set; }
            public Guid ConnectionId { get; set; }
            public IComponentId EndpointId { get; set; }
            public IPluginContext PluginContext { get; set; }
            public IApplicationContext ApplicationContext { get; set; }
            public IEnumerable<string> Domains { get; set; } = [];
        }
    }
}
