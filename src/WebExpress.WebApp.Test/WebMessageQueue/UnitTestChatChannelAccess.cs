using System.Globalization;
using System.Net;
using System.Text.Json;
using WebExpress.WebApp.WebMessageQueue;
using WebExpress.WebCore.WebApplication;
using WebExpress.WebCore.WebComponent;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebParameter;
using WebExpress.WebCore.WebPlugin;
using WebExpress.WebCore.WebSession.Model;
using WebExpress.WebCore.WebSocket;
using WebExpress.WebCore.WebUri;

namespace WebExpress.WebApp.Test.WebMessageQueue
{
    /// <summary>
    /// Tests that a chat message reaches only the clients whose caller may access its channel,
    /// carries the caller of its connection as sender, and that no history is replayed to a
    /// caller outside the channel.
    /// </summary>
    public class UnitTestChatChannelAccess
    {
        /// <summary>
        /// Verifies the default rule: a direct channel for the identities it names, any other for
        /// every signed-in caller, nothing for a caller who is not signed in.
        /// </summary>
        [Fact]
        public void DefaultRule()
        {
            Assert.True(ChatChannelAccess.IsAllowed("a", "direct:a:b"));
            Assert.True(ChatChannelAccess.IsAllowed("b", "direct:a:b"));
            Assert.False(ChatChannelAccess.IsAllowed("c", "direct:a:b"));
            Assert.True(ChatChannelAccess.IsAllowed("c", "team"));
            Assert.False(ChatChannelAccess.IsAllowed(null, "team"));
        }

        /// <summary>
        /// Verifies that the address of a channel selects only the clients whose caller may
        /// access it, which is what travels to the other instances of a cluster as well.
        /// </summary>
        [Fact]
        public void AddressSelectsTheMembersOfTheChannel()
        {
            // arrange
            var address = new AddressDescriptor { ChatChannelId = "direct:a:b" };

            // validation
            Assert.True(address.Matches(new FakeClientSession { IdentityId = "a" }));
            Assert.False(address.Matches(new FakeClientSession { IdentityId = "c" }));
            Assert.False(address.Matches(new FakeClientSession()));
        }

        /// <summary>
        /// Verifies that the sender is the caller of the connection, not what the client claims,
        /// and that a message to a channel the caller may not access is dropped.
        /// </summary>
        [Fact]
        public async Task SenderIsTheCallerAndForeignChannelsAreRefused()
        {
            // arrange
            var manager = new RecordingManager();
            var handler = new ChatMessageHandler(manager, new ChatChannelStore());
            var socket = new FakeSocket(new FakeClientSession { IdentityId = "a" });

            // act
            await handler.HandleAsync(socket, "{\"type\":\"webexpress.webapp.chat.message\",\"channelId\":\"team\",\"sender\":\"admin\",\"text\":\"hi\"}", TestContext.Current.CancellationToken);
            await handler.HandleAsync(socket, "{\"type\":\"webexpress.webapp.chat.message\",\"channelId\":\"direct:b:c\",\"text\":\"spy\"}", TestContext.Current.CancellationToken);

            // validation
            var sent = Assert.Single(manager.Sent);
            using var json = JsonDocument.Parse(sent.Message.ToJson());
            Assert.Equal("a", json.RootElement.GetProperty("sender").GetString());
            Assert.Equal("team", ((AddressDescriptor)sent.Address).ChatChannelId);
        }

        /// <summary>
        /// Verifies that the history of a direct channel is replayed to its members only.
        /// </summary>
        [Fact]
        public async Task HistoryIsReplayedToMembersOnly()
        {
            // arrange
            var handler = new ChatMessageHandler(new RecordingManager(), new ChatChannelStore());
            var member = new FakeSocket(new FakeClientSession { IdentityId = "a" });
            var outsider = new FakeSocket(new FakeClientSession { IdentityId = "c" });
            await handler.HandleAsync(member, "{\"type\":\"webexpress.webapp.chat.message\",\"channelId\":\"direct:a:b\",\"text\":\"secret\"}", TestContext.Current.CancellationToken);

            // act
            await handler.HandleAsync(outsider, "{\"type\":\"webexpress.webapp.chat.history.request\",\"channelId\":\"direct:a:b\"}", TestContext.Current.CancellationToken);
            await handler.HandleAsync(member, "{\"type\":\"webexpress.webapp.chat.history.request\",\"channelId\":\"direct:a:b\"}", TestContext.Current.CancellationToken);

            // validation
            Assert.Empty(outsider.Received);
            Assert.Single(member.Received);
        }

        /// <summary>
        /// Verifies that the system metrics reach only callers with system access, whatever
        /// domains a client subscribed itself.
        /// </summary>
        [Fact]
        public void MetricsReachSystemAdministratorsOnly()
        {
            var address = new AddressDescriptor { Domains = ["metrics"], SystemAccessOnly = true };

            Assert.True(address.Matches(new FakeClientSession { Domains = ["metrics"], HasSystemAccess = true }));
            Assert.False(address.Matches(new FakeClientSession { Domains = ["metrics"] }));
        }

        /// <summary>
        /// Verifies that a broadcast to the users of an application - a global notification, the
        /// progress of a task - reaches signed-in callers only, here and on the other instances
        /// of a cluster. The queue admits visitors who are not signed in.
        /// </summary>
        [Fact]
        public void BroadcastsReachSignedInCallersOnly()
        {
            var address = new AddressApplication(null);

            Assert.True(address.Matches(new FakeClientSession { IdentityId = "a" }));
            Assert.False(address.Matches(new FakeClientSession()));
            Assert.True(address.Describe().Matches(new FakeClientSession { IdentityId = "a" }));
            Assert.False(address.Describe().Matches(new FakeClientSession()));
        }

        private sealed class RecordingManager : IMessageQueueManager
        {
            internal readonly List<(IAddress Address, IMessage Message)> Sent = [];

            public IPopupNotificationHandler PopupNotificationHandler => null;
            public IChatMessageHandler ChatMessageHandler => null;
            public WebExpress.WebApp.WebCollaboration.ICollaborativeDocumentManager CollaborativeDocuments => null;

            public void Dispose()
            {
            }

            public IMessageQueueManager Register(Guid connectionId, IMessageQueueSocket socket) => this;
            public IMessageQueueManager Register(string messageType, Action<IMessage> handler) => this;
            public IMessageQueueManager Unregister(Guid connectionId) => this;
            public IMessageQueueManager Unregister(string messageType, Action<IMessage> handler) => this;

            public Task<IMessageQueueManager> SendAsync(IAddress address, IMessage message, CancellationToken cancellationToken = default)
            {
                Sent.Add((address, message));
                return Task.FromResult<IMessageQueueManager>(this);
            }

            public Task ReplayPopupNotificationsAsync(IMessageQueueSocket socket, CancellationToken cancellationToken = default) => Task.CompletedTask;
            public Task ReplayProgressTasksAsync(IMessageQueueSocket socket, CancellationToken cancellationToken = default) => Task.CompletedTask;
        }

        private sealed class FakeSocket(IClientSession clientSession) : IMessageQueueSocket
        {
            internal readonly List<string> Received = [];

            public IClientSession ClientSession { get; } = clientSession;

            public Task SendAsync(IMessage message, CancellationToken cancellationToken = default)
            {
                Received.Add(message.ToJson());
                return Task.CompletedTask;
            }

            public Task OnConnectedAsync(ISocketConnection socketConnection) => Task.CompletedTask;

            public void Dispose()
            {
            }
        }

        private sealed class FakeClientSession : IClientSession
        {
            public RequestMethod Method { get; set; }
            public IUri Uri { get; set; }
            public Session Session { get; set; }
            public RequestHeaderFields Header { get; set; }
            public EndPoint RemoteEndPoint { get; set; }
            public CultureInfo Culture { get; set; }
            public IEnumerable<IParameter> Parameters { get; set; } = [];
            public string SupportedSubProtocol { get; set; }
            public Guid ConnectionId { get; set; } = Guid.NewGuid();
            public IComponentId EndpointId { get; set; }
            public IPluginContext PluginContext { get; set; }
            public IApplicationContext ApplicationContext { get; set; }
            public IEnumerable<string> Domains { get; set; } = [];
            public string IdentityId { get; set; }
            public bool HasSystemAccess { get; set; }
        }
    }
}
