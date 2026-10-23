using System.Globalization;
using System.Net;
using System.Text.Json;
using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebMessageQueue;
using WebExpress.WebCore.WebApplication;
using WebExpress.WebCore.WebCluster;
using WebExpress.WebCore.WebComponent;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebParameter;
using WebExpress.WebCore.WebPlugin;
using WebExpress.WebCore.WebSession.Model;
using WebExpress.WebCore.WebSocket;
using WebExpress.WebCore.WebUri;
using WebExpress.WebIndex;

namespace WebExpress.WebApp.Test.WebMessageQueue
{
    /// <summary>
    /// Tests that live messages, chat history, task progress and index changes reach clients
    /// connected to any instance of a cluster.
    /// </summary>
    [Collection("NonParallelTests")]
    public sealed class UnitTestMessageQueueCluster : IDisposable
    {
        private readonly string _directory = Path.Combine(Path.GetTempPath(), "wx-cluster-" + Guid.NewGuid().ToString("N"));

        /// <summary>
        /// Removes the shared state directory.
        /// </summary>
        public void Dispose()
        {
            if (Directory.Exists(_directory))
            {
                Directory.Delete(_directory, true);
            }
        }

        /// <summary>
        /// Tests that every built-in address, described for another instance, selects exactly
        /// the clients it selects here.
        /// </summary>
        [Fact]
        public void DescribedAddressesSelectTheSameClients()
        {
            var session = new Session(Guid.NewGuid());
            var clients = new[]
            {
                CreateClient("app-a", session, ["my.order"]),
                CreateClient("app-a", new Session(Guid.NewGuid()), ["my.customer"]),
                CreateClient("app-b", session, []),
                CreateClient(null, null, ["my.order", "my.customer"])
            };
            var addresses = new IAddress[]
            {
                new AddressApplication(null),
                new AddressApplication(CreateApplication("app-a")),
                new AddressSession(session),
                new AddressDomain("my.order"),
                new AddressDomain<FakeDomain>()
            };

            foreach (var address in addresses)
            {
                var descriptor = RoundTrip(address.Describe());

                Assert.Equal(clients.Select(address.Matches), clients.Select(descriptor.Matches));
            }
        }

        /// <summary>
        /// Tests that a sender is left out of a broadcast on every instance, as it is locally.
        /// </summary>
        [Fact]
        public void DescriptorExcludesTheSender()
        {
            var sender = CreateClient("app-a", null, ["doc"]);
            var other = CreateClient("app-a", null, ["doc"]);
            var descriptor = RoundTrip(new AddressDescriptor { Domains = ["doc"], ExcludeConnectionId = sender.ConnectionId });

            Assert.False(descriptor.Matches(sender));
            Assert.True(descriptor.Matches(other));
        }

        /// <summary>
        /// Tests that a message sent on one instance reaches the local clients and is passed on
        /// to the others, and that a message passed on from another instance reaches the local
        /// clients unchanged without being passed on again.
        /// </summary>
        [Fact]
        public async Task MessagesTravelBetweenInstances()
        {
            // arrange
            var hub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var transport = new TestTransport();
            hub.ClusterManager.UseTransport(transport);
            var manager = hub.GetComponentManager<MessageQueueManager>();
            var matching = new TestSocket(CreateClient("app-a", null, ["my.order"]));
            var other = new TestSocket(CreateClient("app-b", null, []));
            manager.Register(Guid.NewGuid(), matching).Register(Guid.NewGuid(), other);

            // act: a change on this instance
            await manager.SendAsync(new AddressDomain("my.order"), new DataChangedMessage("my.order", DataChangeOperation.Updated, "7"), TestContext.Current.CancellationToken);

            // validation
            Assert.Single(matching.Received);
            Assert.Empty(other.Received);
            var (topic, payload) = Assert.Single(transport.Sent);
            Assert.Equal("webexpress.messagequeue", topic);

            // act: the same message arriving from another instance
            transport.Inject(new ClusterMessage(topic, "node-b", payload));
            await Task.Delay(50, TestContext.Current.CancellationToken);

            // validation
            Assert.Equal(2, matching.Received.Count);
            Assert.Equal(matching.Received[0], matching.Received[1]);
            Assert.Empty(other.Received);
            Assert.Single(transport.Sent);
        }

        /// <summary>
        /// Tests that an address that cannot be described stays on its instance.
        /// </summary>
        [Fact]
        public async Task UndescribableAddressStaysLocal()
        {
            var hub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var transport = new TestTransport();
            hub.ClusterManager.UseTransport(transport);
            var manager = hub.GetComponentManager<MessageQueueManager>();

            await manager.SendAsync(new LocalAddress(), new DataChangedMessage("x", DataChangeOperation.Created), TestContext.Current.CancellationToken);

            Assert.Empty(transport.Sent);
        }

        /// <summary>
        /// Tests that the chat history written on one instance is replayed by another, oldest
        /// first and trimmed to the capacity.
        /// </summary>
        [Fact]
        public void ChatHistoryIsShared()
        {
            var shared = new FileClusterStore(_directory);
            var a = new ChatChannelStore(3, () => shared);
            var b = new ChatChannelStore(3, () => shared);

            for (var i = 1; i <= 4; i++)
            {
                (i % 2 == 0 ? a : b).Append("Room", "m" + i, JsonDocument.Parse($"{{\"n\":{i}}}").RootElement);
                Thread.Sleep(2);
            }

            Assert.Equal(["m2", "m3", "m4"], a.GetHistory("room").Select(x => x.MessageId));
            Assert.Equal(4, b.GetHistory("ROOM").Last().Payload.GetProperty("n").GetInt32());
            Assert.Empty(b.GetHistory("other"));
        }

        /// <summary>
        /// Tests that a client connecting to another instance is shown the progress of a task
        /// running elsewhere.
        /// </summary>
        [Fact]
        public async Task TaskProgressIsReplayedAcrossInstances()
        {
            // arrange: instance a runs a task
            var a = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            a.ClusterManager.UseStore(new FileClusterStore(_directory));
            _ = a.GetComponentManager<MessageQueueManager>();
            var task = a.TaskManager.CreateTask("cluster-task-" + Guid.NewGuid().ToString("N"));
            task.Progress = 42;

            // act: a client connects to instance b
            var b = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            b.ClusterManager.UseStore(new FileClusterStore(_directory));
            var socket = new TestSocket(CreateClient("app-a", null, []));
            await b.GetComponentManager<MessageQueueManager>().ReplayProgressTasksAsync(socket, TestContext.Current.CancellationToken);

            // validation
            var replayed = socket.Received.Select(x => JsonDocument.Parse(x).RootElement).Single(x => x.GetProperty("taskId").GetString() == task.Id);
            Assert.Equal(42, replayed.GetProperty("progress").GetInt32());
        }

        /// <summary>
        /// Tests that an index change on one instance is replayed on another, while the copy of
        /// each instance lives apart from the shared data directory.
        /// </summary>
        [Fact]
        public async Task IndexChangesAreReplayed()
        {
            // arrange: two instances whose transports deliver to each other
            var a = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            a.ClusterManager.UseStore(new FileClusterStore(_directory));
            var transportA = new TestTransport();
            a.ClusterManager.UseTransport(transportA);
            var indexA = a.GetComponentManager<WebApp.WebIndex.IndexManager>();

            var b = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var transportB = new TestTransport();
            b.ClusterManager.UseTransport(transportB);
            var indexB = b.GetComponentManager<WebApp.WebIndex.IndexManager>();

            indexA.Create<ClusterIndexItem>(CultureInfo.InvariantCulture, IndexType.Memory);
            indexB.Create<ClusterIndexItem>(CultureInfo.InvariantCulture, IndexType.Memory);

            var item = new ClusterIndexItem { Id = Guid.NewGuid(), Text = "first" };

            // act + validation: insert, update and delete travel
            indexA.Insert(item);
            await DeliverAsync(transportA, transportB);
            Assert.Equal("first", Assert.Single(indexB.All<ClusterIndexItem>()).Text);

            indexA.Update(new ClusterIndexItem { Id = item.Id, Text = "second" });
            await DeliverAsync(transportA, transportB);
            Assert.Equal("second", Assert.Single(indexB.All<ClusterIndexItem>()).Text);

            indexA.Delete(item);
            await DeliverAsync(transportA, transportB);
            Assert.Empty(indexB.All<ClusterIndexItem>());

            // a replayed change is not sent back out
            Assert.Empty(transportB.Sent);
        }

        /// <summary>
        /// Hands everything one test transport sent to another.
        /// </summary>
        /// <param name="from">The sending transport.</param>
        /// <param name="to">The receiving transport.</param>
        /// <returns>A task that completes after the messages were handled.</returns>
        private static async Task DeliverAsync(TestTransport from, TestTransport to)
        {
            // publishing is fire and forget; give it a moment to reach the transport
            await Task.Delay(50, TestContext.Current.CancellationToken);

            foreach (var (topic, payload) in from.Sent.ToList())
            {
                to.Inject(new ClusterMessage(topic, "node-a", payload));
            }

            from.Sent.Clear();
        }

        /// <summary>
        /// Serializes and deserializes a descriptor, as the transport does.
        /// </summary>
        /// <param name="descriptor">The descriptor.</param>
        /// <returns>The descriptor as another instance reads it.</returns>
        private static AddressDescriptor RoundTrip(AddressDescriptor descriptor)
        {
            Assert.NotNull(descriptor);

            return JsonSerializer.Deserialize<AddressDescriptor>(JsonSerializer.Serialize(descriptor));
        }

        /// <summary>
        /// Creates a client session.
        /// </summary>
        /// <param name="applicationId">The application the client is connected to.</param>
        /// <param name="session">The session of the client.</param>
        /// <param name="domains">The domains the client observes.</param>
        /// <returns>The client session.</returns>
        private static FakeClientSession CreateClient(string applicationId, Session session, string[] domains)
        {
            return new FakeClientSession
            {
                ConnectionId = Guid.NewGuid(),
                ApplicationContext = applicationId is null ? null : CreateApplication(applicationId),
                Session = session,
                Domains = domains
            };
        }

        /// <summary>
        /// Creates an application context with the given id.
        /// </summary>
        /// <param name="applicationId">The application id.</param>
        /// <returns>The application context.</returns>
        private static IApplicationContext CreateApplication(string applicationId)
        {
            var context = new ApplicationContext();
            typeof(ApplicationContext).GetProperty(nameof(ApplicationContext.ApplicationId))
                .SetValue(context, applicationId);

            return context;
        }

        /// <summary>
        /// A domain for the type-safe address.
        /// </summary>
        private sealed class FakeDomain : WebExpress.WebCore.WebDomain.IDomain
        {
        }

        /// <summary>
        /// An address deciding on state only this instance has.
        /// </summary>
        private sealed class LocalAddress : IAddress
        {
            /// <summary>
            /// Matches every client.
            /// </summary>
            /// <param name="session">The client session.</param>
            /// <returns>Always true.</returns>
            public bool Matches(IClientSession session) => true;
        }

        /// <summary>
        /// An index item with a single text field.
        /// </summary>
        public sealed class ClusterIndexItem : IIndexItem
        {
            /// <summary>
            /// Gets or sets the id.
            /// </summary>
            public Guid Id { get; set; }

            /// <summary>
            /// Gets or sets the text.
            /// </summary>
            public string Text { get; set; }
        }

        /// <summary>
        /// A transport that records what is published and lets the test inject what arrives.
        /// </summary>
        private sealed class TestTransport : IClusterTransport
        {
            internal readonly List<(string Topic, byte[] Payload)> Sent = [];

            /// <summary>
            /// Raised for injected messages.
            /// </summary>
            public event EventHandler<ClusterMessage> Received;

            /// <summary>
            /// Records the message.
            /// </summary>
            /// <param name="topic">The topic.</param>
            /// <param name="payload">The content.</param>
            /// <param name="cancellationToken">The cancellation token.</param>
            /// <returns>A completed task.</returns>
            public Task SendAsync(string topic, byte[] payload, CancellationToken cancellationToken = default)
            {
                lock (Sent)
                {
                    Sent.Add((topic, payload));
                }

                return Task.CompletedTask;
            }

            /// <summary>
            /// Simulates a message from another instance.
            /// </summary>
            /// <param name="message">The message.</param>
            internal void Inject(ClusterMessage message) => Received?.Invoke(this, message);

            /// <summary>
            /// Does nothing.
            /// </summary>
            public void Dispose()
            {
            }
        }

        /// <summary>
        /// A socket that records the json of every message it is sent.
        /// </summary>
        /// <param name="clientSession">The client session.</param>
        private sealed class TestSocket(IClientSession clientSession) : IMessageQueueSocket
        {
            internal readonly List<string> Received = [];

            /// <summary>
            /// Gets the client session.
            /// </summary>
            public IClientSession ClientSession { get; } = clientSession;

            /// <summary>
            /// Records the message.
            /// </summary>
            /// <param name="message">The message.</param>
            /// <param name="cancellationToken">The cancellation token.</param>
            /// <returns>A completed task.</returns>
            public Task SendAsync(IMessage message, CancellationToken cancellationToken = default)
            {
                lock (Received)
                {
                    Received.Add(message.ToJson());
                }

                return Task.CompletedTask;
            }

            /// <summary>
            /// Does nothing.
            /// </summary>
            /// <param name="socketConnection">The connection.</param>
            /// <returns>A completed task.</returns>
            public Task OnConnectedAsync(ISocketConnection socketConnection) => Task.CompletedTask;

            /// <summary>
            /// Does nothing.
            /// </summary>
            public void Dispose()
            {
            }
        }

        /// <summary>
        /// A client session exposing the fields addresses inspect.
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
