using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Net;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using WebExpress.WebApp.WebMessageQueue;
using WebExpress.WebCore.WebApplication;
using WebExpress.WebCore.WebComponent;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebParameter;
using WebExpress.WebCore.WebPlugin;
using WebExpress.WebCore.WebSession.Model;
using WebExpress.WebCore.WebUri;

namespace WebExpress.WebApp.Test.WebMessageQueue
{
    /// <summary>
    /// Tests for <see cref="CollaborativeMessageHandler"/>.
    /// </summary>
    public class UnitTestCollaborativeMessageHandler
    {
        /// <summary>
        /// Verifies that the constructor rejects a null manager because the
        /// handler cannot operate without a transport.
        /// </summary>
        [Fact]
        public void Constructor_NullManager_Throws()
        {
            Assert.Throws<ArgumentNullException>(() => new CollaborativeMessageHandler(null));
        }

        /// <summary>
        /// Verifies that a null source socket is rejected.
        /// </summary>
        [Fact]
        public async Task HandleAsync_NullSource_Throws()
        {
            var manager = new FakeMessageQueueManager();
            var handler = new CollaborativeMessageHandler(manager);

            await Assert.ThrowsAsync<ArgumentNullException>
            (
                async () => await handler.HandleAsync(null, "{}")
            );
        }

        /// <summary>
        /// Empty payloads must be discarded silently - a misbehaving client
        /// must not be able to push the socket pipeline into an error state.
        /// </summary>
        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        public async Task HandleAsync_EmptyPayload_DoesNotBroadcast(string payload)
        {
            var manager = new FakeMessageQueueManager();
            var handler = new CollaborativeMessageHandler(manager);
            var source = CreateSocket(Guid.NewGuid(), "domain.a");

            await handler.HandleAsync(source, payload);

            Assert.Empty(manager.Sends);
        }

        /// <summary>
        /// Malformed JSON payloads must not trigger a broadcast.
        /// </summary>
        [Fact]
        public async Task HandleAsync_InvalidJson_DoesNotBroadcast()
        {
            var manager = new FakeMessageQueueManager();
            var handler = new CollaborativeMessageHandler(manager);
            var source = CreateSocket(Guid.NewGuid(), "domain.a");

            await handler.HandleAsync(source, "{\"type\":");

            Assert.Empty(manager.Sends);
        }

        /// <summary>
        /// Messages with a non-collaborative type identifier are not routed by
        /// the handler even if they are well formed JSON.
        /// </summary>
        [Fact]
        public async Task HandleAsync_NonCollaborativeType_DoesNotBroadcast()
        {
            var manager = new FakeMessageQueueManager();
            var handler = new CollaborativeMessageHandler(manager);
            var source = CreateSocket(Guid.NewGuid(), "domain.a");

            await handler.HandleAsync(source, "{\"type\":\"webexpress.webapp.change.status\"}");

            Assert.Empty(manager.Sends);
        }

        /// <summary>
        /// Collaborative messages with an unknown sub type are rejected by the
        /// validation step.
        /// </summary>
        [Fact]
        public async Task HandleAsync_UnknownCollaborativeSubtype_DoesNotBroadcast()
        {
            var manager = new FakeMessageQueueManager();
            var handler = new CollaborativeMessageHandler(manager);
            var source = CreateSocket(Guid.NewGuid(), "domain.a");

            await handler.HandleAsync(source, "{\"type\":\"webexpress.webapp.collaborative.unknown\"}");

            Assert.Empty(manager.Sends);
        }

        /// <summary>
        /// Legacy types still emitted by older clients (former
        /// <c>user.join</c> / <c>user.leave</c>) are no longer part of the wire
        /// format and must be discarded so they cannot bypass validation.
        /// </summary>
        [Theory]
        [InlineData("webexpress.webapp.collaborative.user.join")]
        [InlineData("webexpress.webapp.collaborative.user.leave")]
        public async Task HandleAsync_LegacyUserJoinLeave_DoesNotBroadcast(string type)
        {
            var manager = new FakeMessageQueueManager();
            var handler = new CollaborativeMessageHandler(manager);
            var source = CreateSocket(Guid.NewGuid(), "domain.a");

            await handler.HandleAsync(source, "{\"type\":\"" + type + "\"}");

            Assert.Empty(manager.Sends);
        }

        /// <summary>
        /// The JS <c>CollaborativeCtrl</c> represents both join and leave
        /// through the single <c>presence</c> message type. The handler must
        /// therefore accept it as a first class collaborative event.
        /// </summary>
        [Fact]
        public async Task HandleAsync_Presence_IsBroadcast()
        {
            var manager = new FakeMessageQueueManager();
            var handler = new CollaborativeMessageHandler(manager);
            var source = CreateSocket(Guid.NewGuid(), "domain.a");

            var payload = "{\"type\":\"" + CollaborativeMessageTypes.Presence + "\","
                + "\"containerId\":\"collab-1\",\"userId\":\"u-1\","
                + "\"userName\":\"Alice\",\"status\":\"join\"}";

            await handler.HandleAsync(source, payload);

            var send = Assert.Single(manager.Sends);
            Assert.Equal(CollaborativeMessageTypes.Presence, send.Message.Type);
            var collab = Assert.IsType<CollaborativeMessage>(send.Message);
            Assert.Equal("collab-1", collab.AdditionalProperties["containerId"].GetString());
            Assert.Equal("u-1", collab.AdditionalProperties["userId"].GetString());
            Assert.Equal("Alice", collab.AdditionalProperties["userName"].GetString());
            Assert.Equal("join", collab.AdditionalProperties["status"].GetString());
        }

        /// <summary>
        /// A valid cursor payload is forwarded as a single broadcast through
        /// the message queue manager and every top-level field of the
        /// originating client payload is preserved verbatim. The JS controller
        /// reads these fields directly from the broadcast object (for example
        /// <c>payload.containerId</c>), so they must survive the round trip.
        /// </summary>
        [Fact]
        public async Task HandleAsync_ValidCursor_BroadcastsOnce()
        {
            var manager = new FakeMessageQueueManager();
            var handler = new CollaborativeMessageHandler(manager);
            var senderId = Guid.NewGuid();
            var source = CreateSocket(senderId, "domain.a");

            var payload = "{\"type\":\"" + CollaborativeMessageTypes.Cursor + "\","
                + "\"containerId\":\"c1\",\"userId\":\"user-1\",\"x\":100,\"y\":200,\"ts\":42}";

            await handler.HandleAsync(source, payload);

            var send = Assert.Single(manager.Sends);
            Assert.Equal(CollaborativeMessageTypes.Cursor, send.Message.Type);
            var collab = Assert.IsType<CollaborativeMessage>(send.Message);
            Assert.Equal("c1", collab.AdditionalProperties["containerId"].GetString());
            Assert.Equal("user-1", collab.AdditionalProperties["userId"].GetString());
            Assert.Equal(100, collab.AdditionalProperties["x"].GetInt32());
            Assert.Equal(200, collab.AdditionalProperties["y"].GetInt32());
            Assert.Equal(42, collab.AdditionalProperties["ts"].GetInt32());
        }

        /// <summary>
        /// Verifies the actual wire format that peers receive: every client
        /// supplied field stays at the JSON root next to the server enriched
        /// routing metadata, mirroring the shape the JS controller expects.
        /// </summary>
        [Fact]
        public async Task HandleAsync_SerializedJson_KeepsClientFieldsAtRoot()
        {
            var manager = new FakeMessageQueueManager();
            var handler = new CollaborativeMessageHandler(manager);
            var source = CreateSocket(Guid.NewGuid(), "domain.a");

            var payload = "{\"type\":\"" + CollaborativeMessageTypes.Cursor + "\","
                + "\"containerId\":\"c1\",\"userId\":\"user-1\","
                + "\"userName\":\"Bob\",\"userColor\":\"#123456\","
                + "\"x\":50.5,\"y\":60.25,\"ts\":1234567890}";

            await handler.HandleAsync(source, payload);

            var send = Assert.Single(manager.Sends);

            using var document = JsonDocument.Parse(send.Message.ToJson());
            var root = document.RootElement;

            Assert.Equal(CollaborativeMessageTypes.Cursor, root.GetProperty("type").GetString());
            Assert.Equal("c1", root.GetProperty("containerId").GetString());
            Assert.Equal("user-1", root.GetProperty("userId").GetString());
            Assert.Equal("Bob", root.GetProperty("userName").GetString());
            Assert.Equal("#123456", root.GetProperty("userColor").GetString());
            Assert.Equal(50.5, root.GetProperty("x").GetDouble());
            Assert.Equal(60.25, root.GetProperty("y").GetDouble());
            Assert.Equal(1234567890, root.GetProperty("ts").GetInt64());
        }

        /// <summary>
        /// Server controlled fields (in particular the connection id) must not
        /// be duplicated by client supplied entries - even if the client tries
        /// to set them, the server side value wins and only one entry is
        /// written.
        /// </summary>
        [Fact]
        public async Task HandleAsync_SerializedJson_DoesNotDuplicateReservedFields()
        {
            var manager = new FakeMessageQueueManager();
            var handler = new CollaborativeMessageHandler(manager);
            var senderId = Guid.NewGuid();
            var source = CreateSocket(senderId, "domain.a");

            var payload = "{\"type\":\"" + CollaborativeMessageTypes.Cursor + "\","
                + "\"connectionId\":\"forged-by-client\",\"connectionid\":\"also-forged\","
                + "\"messageId\":\"forged-message-id\"}";

            await handler.HandleAsync(source, payload);

            var send = Assert.Single(manager.Sends);

            var json = send.Message.ToJson();
            using var document = JsonDocument.Parse(json);
            var root = document.RootElement;

            var connectionIdCount = 0;
            foreach (var property in root.EnumerateObject())
            {
                if (string.Equals(property.Name, "connectionid", StringComparison.OrdinalIgnoreCase))
                {
                    connectionIdCount++;
                }
            }
            Assert.Equal(1, connectionIdCount);
            Assert.DoesNotContain("forged-by-client", json);
            Assert.DoesNotContain("forged-message-id", json);
        }

        /// <summary>
        /// Each known collaborative subtype must be forwarded so that all four
        /// channels (presence join/leave, cursor, input) round trip correctly.
        /// </summary>
        [Theory]
        [InlineData(CollaborativeMessageTypes.Presence)]
        [InlineData(CollaborativeMessageTypes.Cursor)]
        [InlineData(CollaborativeMessageTypes.Input)]
        [InlineData(CollaborativeMessageTypes.Caret)]
        public async Task HandleAsync_KnownSubtypes_AreBroadcast(string type)
        {
            var manager = new FakeMessageQueueManager();
            var handler = new CollaborativeMessageHandler(manager);
            var source = CreateSocket(Guid.NewGuid(), "domain.a");

            var payload = "{\"type\":\"" + type + "\"}";

            await handler.HandleAsync(source, payload);

            var send = Assert.Single(manager.Sends);
            Assert.Equal(type, send.Message.Type);
        }

        /// <summary>
        /// The handler must always overwrite the connection id with the
        /// server-side identifier of the originating socket so that peers can
        /// reliably detect their own echoes regardless of what the client
        /// claimed in the payload.
        /// </summary>
        [Fact]
        public async Task HandleAsync_OverridesConnectionIdWithSenderIdentity()
        {
            var manager = new FakeMessageQueueManager();
            var handler = new CollaborativeMessageHandler(manager);
            var senderId = Guid.NewGuid();
            var source = CreateSocket(senderId, "domain.a");

            var payload = "{\"type\":\"webexpress.webapp.collaborative.cursor\","
                + "\"connectionId\":\"forged-by-client\"}";

            await handler.HandleAsync(source, payload);

            var send = Assert.Single(manager.Sends);
            Assert.Equal(senderId.ToString("N"), send.Message.ConnectionId);
        }

        /// <summary>
        /// The broadcast address must reject the sender's own session so that
        /// collaborative events are never echoed back to their origin.
        /// </summary>
        [Fact]
        public async Task HandleAsync_BroadcastAddress_ExcludesSender()
        {
            var manager = new FakeMessageQueueManager();
            var handler = new CollaborativeMessageHandler(manager);
            var senderId = Guid.NewGuid();
            var source = CreateSocket(senderId, "domain.a");

            await handler.HandleAsync
            (
                source,
                "{\"type\":\"webexpress.webapp.collaborative.cursor\"}"
            );

            var send = Assert.Single(manager.Sends);
            var senderSession = CreateSession(senderId, "domain.a");
            Assert.False(send.Address.Matches(senderSession));
        }

        /// <summary>
        /// Peers that share at least one domain with the sender must receive
        /// the broadcast.
        /// </summary>
        [Fact]
        public async Task HandleAsync_BroadcastAddress_IncludesPeerInSameDomain()
        {
            var manager = new FakeMessageQueueManager();
            var handler = new CollaborativeMessageHandler(manager);
            var source = CreateSocket(Guid.NewGuid(), "domain.a", "domain.b");

            await handler.HandleAsync
            (
                source,
                "{\"type\":\"webexpress.webapp.collaborative.cursor\"}"
            );

            var send = Assert.Single(manager.Sends);
            var peer = CreateSession(Guid.NewGuid(), "domain.b");
            Assert.True(send.Address.Matches(peer));
        }

        /// <summary>
        /// Peers whose domains do not overlap with the sender's domains must
        /// not receive the broadcast.
        /// </summary>
        [Fact]
        public async Task HandleAsync_BroadcastAddress_ExcludesPeerInOtherDomain()
        {
            var manager = new FakeMessageQueueManager();
            var handler = new CollaborativeMessageHandler(manager);
            var source = CreateSocket(Guid.NewGuid(), "domain.a");

            await handler.HandleAsync
            (
                source,
                "{\"type\":\"webexpress.webapp.collaborative.cursor\"}"
            );

            var send = Assert.Single(manager.Sends);
            var stranger = CreateSession(Guid.NewGuid(), "domain.x");
            Assert.False(send.Address.Matches(stranger));
        }

        /// <summary>
        /// When the sender has no domain affiliation, the broadcast targets
        /// every other connected session so that anonymous collaborative
        /// containers continue to work.
        /// </summary>
        [Fact]
        public async Task HandleAsync_BroadcastAddress_NoSenderDomains_TargetsEveryone()
        {
            var manager = new FakeMessageQueueManager();
            var handler = new CollaborativeMessageHandler(manager);
            var source = CreateSocket(Guid.NewGuid());

            await handler.HandleAsync
            (
                source,
                "{\"type\":\"webexpress.webapp.collaborative.cursor\"}"
            );

            var send = Assert.Single(manager.Sends);
            var peer = CreateSession(Guid.NewGuid(), "domain.x");
            Assert.True(send.Address.Matches(peer));
        }

        /// <summary>
        /// A null candidate session is not a valid recipient.
        /// </summary>
        [Fact]
        public async Task HandleAsync_BroadcastAddress_NullSession_ReturnsFalse()
        {
            var manager = new FakeMessageQueueManager();
            var handler = new CollaborativeMessageHandler(manager);
            var source = CreateSocket(Guid.NewGuid(), "domain.a");

            await handler.HandleAsync
            (
                source,
                "{\"type\":\"webexpress.webapp.collaborative.cursor\"}"
            );

            var send = Assert.Single(manager.Sends);
            Assert.False(send.Address.Matches(null));
        }

        /// <summary>
        /// Simulates the exact wire payload that the client side
        /// <c>_sendCursor</c> produces and verifies that every field the JS
        /// receive handler reads (<c>type</c>, <c>containerId</c>,
        /// <c>userId</c>, <c>x</c>, <c>y</c>) survives the broadcast.
        /// Mirrors the actual flow that drives the cursor overlay.
        /// </summary>
        [Fact]
        public async Task HandleAsync_JsCursorPayload_RoundTripsAllFields()
        {
            var manager = new FakeMessageQueueManager();
            var handler = new CollaborativeMessageHandler(manager);
            var source = CreateSocket(Guid.NewGuid(), "domain.a");

            // exact shape produced by webexpress.webapp.collaborative.js _sendCursor
            var payload = "{\"type\":\"webexpress.webapp.collaborative.cursor\","
                + "\"containerId\":\"collaborative1\","
                + "\"userId\":\"alice\","
                + "\"userName\":\"Alice\","
                + "\"userColor\":\"#3B82F6\","
                + "\"x\":0.42,\"y\":0.18,"
                + "\"ts\":1715628000000}";

            await handler.HandleAsync(source, payload);

            var send = Assert.Single(manager.Sends);
            using var document = JsonDocument.Parse(send.Message.ToJson());
            var root = document.RootElement;

            Assert.Equal("webexpress.webapp.collaborative.cursor", root.GetProperty("type").GetString());
            Assert.Equal("collaborative1", root.GetProperty("containerId").GetString());
            Assert.Equal("alice", root.GetProperty("userId").GetString());
            Assert.Equal("Alice", root.GetProperty("userName").GetString());
            Assert.Equal("#3B82F6", root.GetProperty("userColor").GetString());
            Assert.Equal(0.42, root.GetProperty("x").GetDouble());
            Assert.Equal(0.18, root.GetProperty("y").GetDouble());
        }

        /// <summary>
        /// Simulates the exact wire payload that the client side
        /// <c>_sendInput</c> produces and verifies that every field the JS
        /// receive handler reads (<c>type</c>, <c>containerId</c>,
        /// <c>userId</c>, <c>fieldId</c>, <c>value</c>) survives the
        /// broadcast.
        /// </summary>
        [Fact]
        public async Task HandleAsync_JsInputPayload_RoundTripsAllFields()
        {
            var manager = new FakeMessageQueueManager();
            var handler = new CollaborativeMessageHandler(manager);
            var source = CreateSocket(Guid.NewGuid(), "domain.a");

            var payload = "{\"type\":\"webexpress.webapp.collaborative.input\","
                + "\"containerId\":\"collaborative1\","
                + "\"userId\":\"alice\","
                + "\"userName\":\"Alice\","
                + "\"userColor\":\"#3B82F6\","
                + "\"fieldId\":\"title\","
                + "\"value\":\"hello world\","
                + "\"selectionStart\":11,\"selectionEnd\":11,"
                + "\"ts\":1715628000000}";

            await handler.HandleAsync(source, payload);

            var send = Assert.Single(manager.Sends);
            using var document = JsonDocument.Parse(send.Message.ToJson());
            var root = document.RootElement;

            Assert.Equal("webexpress.webapp.collaborative.input", root.GetProperty("type").GetString());
            Assert.Equal("collaborative1", root.GetProperty("containerId").GetString());
            Assert.Equal("alice", root.GetProperty("userId").GetString());
            Assert.Equal("title", root.GetProperty("fieldId").GetString());
            Assert.Equal("hello world", root.GetProperty("value").GetString());
            Assert.Equal(11, root.GetProperty("selectionStart").GetInt32());
        }

        /// <summary>
        /// Simulates the exact wire payload that the client side
        /// <c>_sendCaret</c> produces (selection movement without text change)
        /// and verifies that the receiver gets all fields needed to render the
        /// remote beam at the new position.
        /// </summary>
        [Fact]
        public async Task HandleAsync_JsCaretPayload_RoundTripsAllFields()
        {
            var manager = new FakeMessageQueueManager();
            var handler = new CollaborativeMessageHandler(manager);
            var source = CreateSocket(Guid.NewGuid(), "domain.a");

            var payload = "{\"type\":\"webexpress.webapp.collaborative.caret\","
                + "\"containerId\":\"collaborative1\","
                + "\"userId\":\"alice\","
                + "\"userName\":\"Alice\","
                + "\"userColor\":\"#3B82F6\","
                + "\"fieldId\":\"title\","
                + "\"selectionStart\":7,\"selectionEnd\":7,"
                + "\"ts\":1715628000000}";

            await handler.HandleAsync(source, payload);

            var send = Assert.Single(manager.Sends);
            using var document = JsonDocument.Parse(send.Message.ToJson());
            var root = document.RootElement;

            Assert.Equal("webexpress.webapp.collaborative.caret", root.GetProperty("type").GetString());
            Assert.Equal("collaborative1", root.GetProperty("containerId").GetString());
            Assert.Equal("alice", root.GetProperty("userId").GetString());
            Assert.Equal("title", root.GetProperty("fieldId").GetString());
            Assert.Equal(7, root.GetProperty("selectionStart").GetInt32());
            Assert.Equal(7, root.GetProperty("selectionEnd").GetInt32());
        }

        /// <summary>
        /// Creates a minimal <see cref="IMessageQueueSocket"/> stub used by the
        /// handler. Only the client session is exercised by the production code.
        /// </summary>
        private static FakeMessageQueueSocket CreateSocket(Guid connectionId, params string[] domains)
        {
            return new FakeMessageQueueSocket(CreateSession(connectionId, domains));
        }

        /// <summary>
        /// Creates a minimal <see cref="IClientSession"/> stub carrying only the
        /// data inspected by the broadcast address.
        /// </summary>
        private static FakeClientSession CreateSession(Guid connectionId, params string[] domains)
        {
            return new FakeClientSession
            {
                ConnectionId = connectionId,
                Domains = domains
            };
        }

        /// <summary>
        /// Captures a single broadcast performed by the handler.
        /// </summary>
        private sealed record CapturedSend(IAddress Address, IMessage Message);

        /// <summary>
        /// Hand-rolled fake replacing <see cref="IMessageQueueManager"/> in
        /// tests. Captures every broadcast for later inspection.
        /// </summary>
        private sealed class FakeMessageQueueManager : IMessageQueueManager
        {
            public List<CapturedSend> Sends { get; } = [];

            public IMessageQueueManager Register(Guid connectionId, IMessageQueueSocket socket) => this;
            public IMessageQueueManager Register(string messageType, Action<IMessage> handler) => this;
            public IMessageQueueManager Unregister(Guid connectionId) => this;
            public IMessageQueueManager Unregister(string messageType, Action<IMessage> handler) => this;

            public Task<IMessageQueueManager> SendAsync(IAddress address, IMessage message, CancellationToken cancellationToken = default)
            {
                Sends.Add(new CapturedSend(address, message));
                return Task.FromResult<IMessageQueueManager>(this);
            }

            public Task ReplayPopupNotificationsAsync(IMessageQueueSocket socket, CancellationToken cancellationToken = default)
                => Task.CompletedTask;

            public Task ReplayProgressTasksAsync(IMessageQueueSocket socket, CancellationToken cancellationToken = default)
                => Task.CompletedTask;

            public IPopupNotificationHandler PopupNotificationHandler => null;

            public IChatMessageHandler ChatMessageHandler => null;

            public void Dispose()
            {
            }
        }

        /// <summary>
        /// Minimal socket fake. The production handler only reads the
        /// <see cref="IMessageQueueSocket.ClientSession"/> property.
        /// </summary>
        private sealed class FakeMessageQueueSocket : IMessageQueueSocket
        {
            public FakeMessageQueueSocket(IClientSession clientSession)
            {
                ClientSession = clientSession;
            }

            public IClientSession ClientSession { get; }

            public Task OnConnectedAsync(WebCore.WebSocket.ISocketConnection socketConnection)
                => Task.CompletedTask;

            public Task SendAsync(IMessage message, CancellationToken cancellationToken = default)
                => Task.CompletedTask;

            public void Dispose()
            {
            }
        }

        /// <summary>
        /// Minimal client session fake exposing only the fields the handler
        /// actually inspects: <see cref="ConnectionId"/> and
        /// <see cref="Domains"/>. All other members are stubbed to default
        /// values.
        /// </summary>
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
            public Guid ConnectionId { get; set; }
            public IComponentId EndpointId { get; set; }
            public IPluginContext PluginContext { get; set; }
            public IApplicationContext ApplicationContext { get; set; }
            public IEnumerable<string> Domains { get; set; } = [];
        }
    }
}
