using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Net;
using System.Text.Json.Nodes;
using System.Threading;
using System.Threading.Tasks;
using WebExpress.WebApp.WebCollaboration;
using WebExpress.WebApp.WebMessageQueue;
using WebExpress.WebCore.WebApplication;
using WebExpress.WebCore.WebComponent;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebParameter;
using WebExpress.WebCore.WebPlugin;
using WebExpress.WebCore.WebSession.Model;
using WebExpress.WebCore.WebUri;

namespace WebExpress.WebApp.Test.WebCollaboration
{
    /// <summary>
    /// Tests the sequencer of shared documents: admission, ordering, rejection on an outdated
    /// base, deduplication, validation, resumption, history trimming and access control.
    /// </summary>
    public class UnitTestCollaborativeDocumentManager
    {
        private const string Prefix = "webexpress.webapp.collaborative.ot.";
        private const string Document = "page/field";

        /// <summary>
        /// A paragraph with the given text in a region of a row, as packed tokens.
        /// </summary>
        private static JsonArray Paragraph(string text) => JsonNode.Parse(
            "[{\"t\":\"o\",\"n\":\"row\",\"id\":\"n1\",\"a\":{}},{\"t\":\"o\",\"n\":\"region\",\"id\":\"n2\",\"a\":{\"weight\":1}}," +
            "{\"t\":\"o\",\"n\":\"p\",\"id\":\"n3\",\"a\":{}},{\"t\":\"s\",\"v\":\"" + text + "\",\"m\":{}},{\"t\":\"e\",\"n\":\"p\",\"id\":\"n3\"}," +
            "{\"t\":\"e\",\"n\":\"region\",\"id\":\"n2\"},{\"t\":\"e\",\"n\":\"row\",\"id\":\"n1\"}]").AsArray();

        /// <summary>
        /// An insertion of text at a position, as a step list.
        /// </summary>
        private static JsonArray Insert(int position, string text) => JsonNode.Parse(
            "[{\"type\":\"replace\",\"from\":" + position + ",\"to\":" + position + ",\"slice\":[{\"t\":\"s\",\"v\":\"" + text + "\",\"m\":{}}]}]").AsArray();

        static UnitTestCollaborativeDocumentManager()
        {
            CollaborativeAccess.UseKey(new byte[32]);
        }

        /// <summary>
        /// The first writer seeds the document and receives it back as the state of version 0.
        /// </summary>
        [Fact]
        public async Task Join_FirstWriterSeedsTheDocument()
        {
            var (manager, queue) = Create();
            var alice = Socket();

            await Join(manager, alice, "alice", Paragraph("hello"));

            var reply = queue.Last(alice);
            Assert.Equal(Prefix + "state", (string)reply["type"]);
            Assert.Equal(0, (long)reply["version"]);
            Assert.Equal(1, (int)reply["protocol"]);
            Assert.True(JsonNode.DeepEquals(OtDocument.Compact(OtDocument.Expand(Paragraph("hello"))), reply["state"]));
        }

        /// <summary>
        /// A later client receives the existing document instead of replacing it with its own.
        /// </summary>
        [Fact]
        public async Task Join_LaterClientReceivesTheExistingDocument()
        {
            var (manager, queue) = Create();
            var alice = Socket();
            var bob = Socket();

            await Join(manager, alice, "alice", Paragraph("hello"));
            await Join(manager, bob, "bob", Paragraph("other"));

            Assert.Contains("hello", queue.Last(bob)["state"].ToJsonString());
        }

        /// <summary>
        /// A token for another scope, a forged token and a reader seeding an unknown document
        /// are refused.
        /// </summary>
        [Fact]
        public async Task Join_WithoutValidAccessIsForbidden()
        {
            var (manager, queue) = Create();
            var socket = Socket();

            await Send(manager, socket, Message("join", "alice", CollaborativeAccess.CreateToken("other", true), m => { m["kind"] = "richtext"; m["state"] = Paragraph("x"); }));
            Assert.Equal("forbidden", (string)queue.Last(socket)["reason"]);

            var forged = CollaborativeAccess.CreateToken("page", true)[..^2] + "AA";
            await Send(manager, socket, Message("join", "alice", forged, m => { m["kind"] = "richtext"; m["state"] = Paragraph("x"); }));
            Assert.Equal("forbidden", (string)queue.Last(socket)["reason"]);

            await Send(manager, socket, Message("join", "alice", CollaborativeAccess.CreateToken("page", false), m => { m["kind"] = "richtext"; m["state"] = Paragraph("x"); }));
            Assert.Equal("forbidden", (string)queue.Last(socket)["reason"]);
        }

        /// <summary>
        /// A seed that violates the schema never becomes a document.
        /// </summary>
        [Fact]
        public async Task Join_InvalidSeedIsRejected()
        {
            var (manager, queue) = Create();
            var socket = Socket();
            var seed = JsonNode.Parse("[{\"t\":\"s\",\"v\":\"loose text\",\"m\":{}}]").AsArray();

            await Join(manager, socket, "alice", seed);

            Assert.Equal("invalid", (string)queue.Last(socket)["reason"]);
            Assert.Equal(-1, manager.Store.GetVersion(Document));
        }

        /// <summary>
        /// An operation on the current version is acknowledged to its sender and distributed to
        /// every other member, with the next version.
        /// </summary>
        [Fact]
        public async Task Submit_AcknowledgesAndDistributes()
        {
            var (manager, queue) = Create();
            var alice = Socket();
            var bob = Socket();

            await Join(manager, alice, "alice", Paragraph("hello"));
            await Join(manager, bob, "bob", Paragraph("hello"));
            await Submit(manager, alice, "alice", 1, 0, Insert(8, "!"));

            var ack = queue.Last(alice, "ack");
            Assert.Equal(1, (long)ack["operations"][0]["version"]);
            Assert.Equal("alice", (string)ack["to"]);
            Assert.Equal(1, (long)queue.Last(alice, "operations")["operations"][0]["version"]);

            var broadcast = queue.Last(bob);
            Assert.Null(broadcast["to"]);
            Assert.Equal(Prefix + "operations", (string)broadcast["type"]);
            Assert.Equal("alice", (string)broadcast["operations"][0]["client"]);
            Assert.Equal(1, (long)broadcast["operations"][0]["version"]);
            Assert.Equal(1, manager.Store.GetVersion(Document));
        }

        /// <summary>
        /// A repeated operation is answered with the acknowledgement it got the first time and is
        /// not applied a second time.
        /// </summary>
        [Fact]
        public async Task Submit_DuplicateIsAcknowledgedWithoutApplying()
        {
            var (manager, queue) = Create();
            var alice = Socket();

            await Join(manager, alice, "alice", Paragraph("hello"));
            await Submit(manager, alice, "alice", 1, 0, Insert(8, "!"));
            await Submit(manager, alice, "alice", 1, 0, Insert(8, "!"));

            var ack = queue.Last(alice);
            Assert.Equal(Prefix + "ack", (string)ack["type"]);
            Assert.Equal(1, (long)ack["operations"][0]["version"]);
            Assert.Single(manager.Store.LoadOperations(Document, 0));
        }

        /// <summary>
        /// An operation on an outdated version is rejected together with the operations its
        /// sender missed; the server does not transform it.
        /// </summary>
        [Fact]
        public async Task Submit_OutdatedBaseIsRejectedWithTheMissedOperations()
        {
            var (manager, queue) = Create();
            var alice = Socket();
            var bob = Socket();

            await Join(manager, alice, "alice", Paragraph("hello"));
            await Join(manager, bob, "bob", Paragraph("hello"));
            await Submit(manager, alice, "alice", 1, 0, Insert(3, "A"));
            await Submit(manager, bob, "bob", 1, 0, Insert(3, "B"));

            var reject = queue.Last(bob);
            Assert.Equal(Prefix + "reject", (string)reject["type"]);
            Assert.Equal("version", (string)reject["reason"]);
            Assert.Equal(1, (long)reject["seq"]);
            Assert.Single(reject["operations"].AsArray());
            Assert.Equal("alice", (string)reject["operations"][0]["client"]);
            Assert.Equal(1, manager.Store.GetVersion(Document));
        }

        /// <summary>
        /// Operations that break the structure or smuggle in unsafe content are rejected and
        /// leave the document unchanged.
        /// </summary>
        [Theory]
        [InlineData("[{\"type\":\"replace\",\"from\":2,\"to\":3,\"slice\":[]}]")]
        [InlineData("[{\"type\":\"replace\",\"from\":3,\"to\":3,\"slice\":[{\"t\":\"o\",\"n\":\"div\",\"id\":\"n9\",\"a\":{}},{\"t\":\"e\",\"n\":\"div\",\"id\":\"n9\"}]}]")]
        [InlineData("[{\"type\":\"addMark\",\"from\":3,\"to\":5,\"name\":\"link\",\"value\":{\"href\":\"javascript:alert(1)\",\"target\":\"\"}}]")]
        [InlineData("[{\"type\":\"addMark\",\"from\":3,\"to\":5,\"name\":\"color\",\"value\":\"expression(alert(1))\"}]")]
        [InlineData("[{\"type\":\"replace\",\"from\":4,\"to\":4,\"slice\":[{\"t\":\"l\",\"n\":\"image\",\"id\":\"n9\",\"a\":{\"src\":\"javascript:x\",\"alt\":\"\"}}]}]")]
        [InlineData("[{\"type\":\"setAttr\",\"pos\":1,\"key\":\"weight\",\"value\":\"<b>\"}]")]
        [InlineData("[{\"type\":\"replace\",\"from\":99,\"to\":99,\"slice\":[]}]")]
        [InlineData("[{\"type\":\"explode\"}]")]
        public async Task Submit_InvalidOperationIsRejected(string steps)
        {
            var (manager, queue) = Create();
            var alice = Socket();

            await Join(manager, alice, "alice", Paragraph("hello"));
            await Submit(manager, alice, "alice", 1, 0, JsonNode.Parse(steps).AsArray());

            Assert.Equal("invalid", (string)queue.Last(alice)["reason"]);
            Assert.Equal(0, manager.Store.GetVersion(Document));
        }

        /// <summary>
        /// A reader may receive a document but not change it.
        /// </summary>
        [Fact]
        public async Task Submit_WithReadOnlyTokenIsForbidden()
        {
            var (manager, queue) = Create();
            var alice = Socket();
            var reader = Socket();

            await Join(manager, alice, "alice", Paragraph("hello"));
            await Send(manager, reader, Message("join", "reader", CollaborativeAccess.CreateToken("page", false), m => m["kind"] = "richtext"));
            Assert.Equal(Prefix + "state", (string)queue.Last(reader)["type"]);

            await Send(manager, reader, Message("submit", "reader", CollaborativeAccess.CreateToken("page", false), m => m["operations"] = Operations("reader", 1, 0, Insert(4, "x"))));
            Assert.Equal("forbidden", (string)queue.Last(reader)["reason"]);
        }

        /// <summary>
        /// A client id is bound to the secret it first used, so nobody can claim another client's
        /// operations as acknowledged.
        /// </summary>
        [Fact]
        public async Task Submit_WithAnotherClientsIdIsForbidden()
        {
            var (manager, queue) = Create();
            var alice = Socket();
            var mallory = Socket();

            await Join(manager, alice, "alice", Paragraph("hello"));
            await Send(manager, mallory, Message("submit", "alice", Token(), m => m["operations"] = Operations("alice", 1, 0, Insert(4, "x")), secret: "guess"));

            Assert.Equal("forbidden", (string)queue.Last(mallory)["reason"]);
            Assert.Equal(0, manager.Store.GetVersion(Document));
        }

        /// <summary>
        /// A returning client receives exactly what it missed.
        /// </summary>
        [Fact]
        public async Task Resume_SendsTheMissedOperations()
        {
            var (manager, queue) = Create();
            var alice = Socket();
            var bob = Socket();

            await Join(manager, alice, "alice", Paragraph("hello"));
            await Join(manager, bob, "bob", Paragraph("hello"));
            await Submit(manager, alice, "alice", 1, 0, Insert(3, "a"));
            await Submit(manager, alice, "alice", 2, 1, Insert(3, "b"));

            await Send(manager, bob, Message("resume", "bob", Token(), m => m["version"] = 1));

            var reply = queue.Last(bob);
            Assert.Equal(Prefix + "operations", (string)reply["type"]);
            Assert.True((bool)reply["resumed"]);
            Assert.Equal(2, (long)Assert.Single(reply["operations"].AsArray())["version"]);
        }

        /// <summary>
        /// The history is trimmed only as far as clients may still need it; a client that falls
        /// behind the kept history is resynchronized with the complete state.
        /// </summary>
        [Fact]
        public async Task Resume_BehindTheKeptHistoryReceivesTheState()
        {
            var (manager, queue) = Create();
            manager.SnapshotInterval = 10;
            manager.Retention = TimeSpan.Zero;
            var alice = Socket();

            await Join(manager, alice, "alice", Paragraph("hello"));

            for (var i = 0; i < 130; i++)
            {
                await Submit(manager, alice, "alice", i + 1, i, Insert(3, "x"));
            }

            Assert.True(manager.Store.LoadOperations(Document, 0).Count < 130, "old operations were trimmed");
            Assert.True(manager.Store.LoadOperations(Document, 0).Count >= 100, "the most recent ones are always kept");

            await Send(manager, alice, Message("resume", "alice", Token(), m => m["version"] = 1));

            var reply = queue.Last(alice);
            Assert.Equal(Prefix + "state", (string)reply["type"]);
            Assert.Equal(130, (long)reply["version"]);
        }

        /// <summary>
        /// A client seen recently keeps the history it needs from being trimmed.
        /// </summary>
        [Fact]
        public async Task Snapshot_KeepsTheHistoryARecentClientNeeds()
        {
            var (manager, _) = Create();
            manager.SnapshotInterval = 10;
            var alice = Socket();
            var bob = Socket();

            await Join(manager, alice, "alice", Paragraph("hello"));
            await Join(manager, bob, "bob", Paragraph("hello"));

            for (var i = 0; i < 150; i++)
            {
                await Submit(manager, alice, "alice", i + 1, i, Insert(3, "x"));
            }

            Assert.Equal(150, manager.Store.LoadOperations(Document, 0).Count);
        }

        /// <summary>
        /// A restarted server restores the document from the snapshot and the operations after
        /// it, and still recognizes operations it applied before the restart.
        /// </summary>
        [Fact]
        public async Task Restart_RestoresTheDocumentAndItsClients()
        {
            var (manager, queue) = Create();
            manager.SnapshotInterval = 3;
            var alice = Socket();

            await Join(manager, alice, "alice", Paragraph("hello"));

            for (var i = 0; i < 5; i++)
            {
                await Submit(manager, alice, "alice", i + 1, i, Insert(3, "x"));
            }

            var restarted = new CollaborativeDocumentManager(queue) { Store = manager.Store };
            await Submit(restarted, alice, "alice", 5, 4, Insert(3, "x"));

            Assert.Equal(5, (long)queue.Last(alice)["operations"][0]["version"]);
            Assert.Equal(5, restarted.Store.GetVersion(Document));

            await Send(restarted, alice, Message("resume", "alice", Token(), m => m["version"] = 0));
            Assert.Equal(5, queue.Last(alice)["operations"].AsArray().Count);
            Assert.Equal("xxxxxhello", Text(restarted));
        }

        /// <summary>
        /// A closed connection receives no further operations.
        /// </summary>
        [Fact]
        public async Task Disconnect_StopsTheDistribution()
        {
            var (manager, queue) = Create();
            var alice = Socket();
            var bob = Socket();

            await Join(manager, alice, "alice", Paragraph("hello"));
            await Join(manager, bob, "bob", Paragraph("hello"));
            manager.Disconnect(bob.ClientSession.ConnectionId);
            var before = queue.Count(bob);

            await Submit(manager, alice, "alice", 1, 0, Insert(3, "x"));

            Assert.Equal(before, queue.Count(bob));
        }

        /// <summary>
        /// A client speaking another protocol version is told so instead of being misunderstood.
        /// </summary>
        [Fact]
        public async Task Message_WithAnotherProtocolIsRejected()
        {
            var (manager, queue) = Create();
            var alice = Socket();

            await Send(manager, alice, Message("join", "alice", Token(), m => { m["protocol"] = 2; m["kind"] = "richtext"; m["state"] = Paragraph("x"); }));

            Assert.Equal("protocol", (string)queue.Last(alice)["reason"]);
        }

        /// <summary>
        /// Shared plain text accepts unformatted characters only.
        /// </summary>
        [Fact]
        public void PlainTextSchema_AcceptsUnformattedTextOnly()
        {
            var schema = new PlainTextSchema();

            Assert.True(schema.Validate(OtDocument.Expand(JsonNode.Parse("[{\"t\":\"s\",\"v\":\"a = 1\\nb\"}]")), out _));
            Assert.False(schema.Validate(OtDocument.Expand(JsonNode.Parse("[{\"t\":\"s\",\"v\":\"a\",\"m\":{\"bold\":true}}]")), out _));
            Assert.False(schema.Validate(OtDocument.Expand(JsonNode.Parse("[{\"t\":\"l\",\"n\":\"image\",\"id\":\"x\"}]")), out _));
        }

        /// <summary>
        /// A shared graph holds node and edge leaves whose edges connect existing nodes.
        /// </summary>
        [Fact]
        public void GraphSchema_RequiresConnectedEdges()
        {
            var schema = new GraphSchema();
            var valid = "[{\"t\":\"l\",\"n\":\"node\",\"id\":\"a\",\"a\":{\"x\":1,\"label\":\"A\"}},{\"t\":\"l\",\"n\":\"node\",\"id\":\"b\",\"a\":{}}," +
                "{\"t\":\"l\",\"n\":\"edge\",\"id\":\"e\",\"a\":{\"from\":\"a\",\"to\":\"b\",\"waypoints\":[{\"x\":1,\"y\":2}]}}]";

            Assert.True(schema.Validate(OtDocument.Expand(JsonNode.Parse(valid)), out var reason), reason);
            Assert.False(schema.Validate(OtDocument.Expand(JsonNode.Parse(valid.Replace("\"to\":\"b\"", "\"to\":\"c\""))), out _));
            Assert.False(schema.Validate(OtDocument.Expand(JsonNode.Parse(valid.Replace("\"id\":\"b\"", "\"id\":\"a\""))), out _));
            Assert.False(schema.Validate(OtDocument.Expand(JsonNode.Parse("[{\"t\":\"c\",\"v\":\"x\"}]")), out _));
        }

        /// <summary>
        /// Tokens cover their scope and the documents below it, nothing else.
        /// </summary>
        [Fact]
        public void AccessToken_CoversItsScopeOnly()
        {
            var token = CollaborativeAccess.CreateToken("page", true);

            Assert.True(CollaborativeAccess.TryValidate(token, "page", out var write) && write);
            Assert.True(CollaborativeAccess.TryValidate(token, "page/field", out _));
            Assert.False(CollaborativeAccess.TryValidate(token, "pages/field", out _));
            Assert.False(CollaborativeAccess.TryValidate(token, "other/field", out _));
            Assert.True(CollaborativeAccess.TryValidate(CollaborativeAccess.CreateToken("page", false), "page/field", out var readOnly) && !readOnly);
            Assert.False(CollaborativeAccess.TryValidate(token.Replace(".w.", ".r."), "page/field", out _));
            Assert.False(CollaborativeAccess.TryValidate("garbage", "page/field", out _));
        }

        /// <summary>
        /// Rebuilds the text of the document from the stored history.
        /// </summary>
        private static string Text(CollaborativeDocumentManager manager)
        {
            var tokens = OtDocument.Expand(Paragraph("hello"));

            foreach (var op in manager.Store.LoadOperations(Document, 0))
            {
                tokens = OtDocument.Apply(tokens, op.Steps);
            }

            return new string([.. tokens.Where(t => t.Kind == OtToken.Character).Select(t => t.Value)]);
        }

        /// <summary>
        /// Creates a sequencer with a recording queue.
        /// </summary>
        private static (CollaborativeDocumentManager Manager, FakeQueue Queue) Create()
        {
            var queue = new FakeQueue();

            return (new CollaborativeDocumentManager(queue) { Store = new MemoryCollaborativeDocumentStore() }, queue);
        }

        private static string Token() => CollaborativeAccess.CreateToken("page", true);

        private static Task Join(CollaborativeDocumentManager manager, FakeSocket socket, string client, JsonArray state)
        {
            return Send(manager, socket, Message("join", client, Token(), m => { m["kind"] = "richtext"; m["state"] = state; }));
        }

        private static Task Submit(CollaborativeDocumentManager manager, FakeSocket socket, string client, long seq, long version, JsonArray steps)
        {
            return Send(manager, socket, Message("submit", client, Token(), m => m["operations"] = Operations(client, seq, version, steps)));
        }

        private static JsonArray Operations(string client, long seq, long version, JsonArray steps)
        {
            return [new JsonObject { ["id"] = client + ":" + seq, ["client"] = client, ["seq"] = seq, ["base"] = version, ["steps"] = steps }];
        }

        private static JsonObject Message(string type, string client, string token, Action<JsonObject> fill, string secret = null)
        {
            var message = new JsonObject
            {
                ["type"] = Prefix + type,
                ["protocol"] = 1,
                ["document"] = Document,
                ["token"] = token,
                ["client"] = client,
                ["secret"] = secret ?? "secret-of-" + client
            };

            fill(message);

            return message;
        }

        private static Task Send(CollaborativeDocumentManager manager, FakeSocket socket, JsonObject message)
        {
            return manager.HandleAsync(socket, message.ToJsonString(), TestContext.Current.CancellationToken);
        }

        private static FakeSocket Socket() => new(new FakeSession { ConnectionId = Guid.NewGuid() });

        /// <summary>
        /// Records what the sequencer sends to whom.
        /// </summary>
        private sealed class FakeQueue : IMessageQueueManager
        {
            private readonly List<(IAddress Address, JsonObject Message)> _sends = [];

            public JsonObject Last(FakeSocket socket, string type = null) => _sends.Last(x => x.Address.Matches(socket.ClientSession) && (type is null || ((string)x.Message["type"]).EndsWith("." + type))).Message;

            public int Count(FakeSocket socket) => _sends.Count(x => x.Address.Matches(socket.ClientSession));

            public Task<IMessageQueueManager> SendAsync(IAddress address, IMessage message, CancellationToken cancellationToken = default)
            {
                _sends.Add((address, JsonNode.Parse(message.ToJson()).AsObject()));

                return Task.FromResult<IMessageQueueManager>(this);
            }

            public IMessageQueueManager Register(Guid connectionId, IMessageQueueSocket socket) => this;
            public IMessageQueueManager Register(string messageType, Action<IMessage> handler) => this;
            public IMessageQueueManager Unregister(Guid connectionId) => this;
            public IMessageQueueManager Unregister(string messageType, Action<IMessage> handler) => this;
            public Task ReplayPopupNotificationsAsync(IMessageQueueSocket socket, CancellationToken cancellationToken = default) => Task.CompletedTask;
            public Task ReplayProgressTasksAsync(IMessageQueueSocket socket, CancellationToken cancellationToken = default) => Task.CompletedTask;
            public IPopupNotificationHandler PopupNotificationHandler => null;
            public IChatMessageHandler ChatMessageHandler => null;
            public ICollaborativeDocumentManager CollaborativeDocuments => null;
            public void Dispose() { }
        }

        /// <summary>
        /// A socket that only carries its session.
        /// </summary>
        private sealed class FakeSocket(IClientSession session) : IMessageQueueSocket
        {
            public IClientSession ClientSession { get; } = session;
            public Task OnConnectedAsync(WebCore.WebSocket.ISocketConnection socketConnection) => Task.CompletedTask;
            public Task SendAsync(IMessage message, CancellationToken cancellationToken = default) => Task.CompletedTask;
            public void Dispose() { }
        }

        /// <summary>
        /// A session that only carries its connection id.
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
