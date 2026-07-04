using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Net;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebMessageQueue;
using WebExpress.WebCore.WebApplication;
using WebExpress.WebCore.WebComponent;
using WebExpress.WebCore.WebDomain;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebParameter;
using WebExpress.WebCore.WebPlugin;
using WebExpress.WebCore.WebSession.Model;
using WebExpress.WebCore.WebSocket;
using WebExpress.WebCore.WebUri;

namespace WebExpress.WebApp.Test.WebMessageQueue
{
    /// <summary>
    /// Tests the data change notification channel: the wire shape of the
    /// <see cref="DataChangedMessage"/>, the domain based addressing, the
    /// runtime <see cref="DataSubscription"/> a client extends its session
    /// with, and the <see cref="DataChangedNotifier"/> entry point the
    /// backend announces changes through. Together these pin the contract the
    /// JavaScript ViewState consumes to re-query its resources when data
    /// changes on the server - including changes made by other users.
    /// </summary>
    public class UnitTestDataChanged
    {
        /// <summary>
        /// A domain type whose full name pins the wire derivation.
        /// </summary>
        private sealed class FakeDomain : IDomain
        {
        }

        /// <summary>
        /// Tests that the change message serializes into the wire shape the
        /// JavaScript ViewState reads: the type, the domain, the lower case
        /// operation and the item id at the JSON root.
        /// </summary>
        [Fact]
        public void ChangedMessageSerializesTheWireShape()
        {
            var message = new DataChangedMessage("my.app.order", DataChangeOperation.Updated, "42");

            using var document = JsonDocument.Parse(message.ToJson());
            var root = document.RootElement;

            Assert.Equal("webexpress.webapp.data.changed", root.GetProperty("type").GetString());
            Assert.Equal("my.app.order", root.GetProperty("domain").GetString());
            Assert.Equal("updated", root.GetProperty("operation").GetString());
            Assert.Equal("42", root.GetProperty("itemId").GetString());
        }

        /// <summary>
        /// Tests that a missing item id is omitted from the wire, which the
        /// client treats as "anything of this domain may have changed".
        /// </summary>
        [Fact]
        public void ChangedMessageOmitsAMissingItemId()
        {
            var message = new DataChangedMessage("my.app.order", DataChangeOperation.Deleted);

            using var document = JsonDocument.Parse(message.ToJson());

            Assert.False(document.RootElement.TryGetProperty("itemId", out _));
        }

        /// <summary>
        /// Tests that a change message without a domain is rejected, because
        /// the client could not route it to any scope.
        /// </summary>
        [Fact]
        public void ChangedMessageRequiresADomain()
        {
            Assert.Throws<ArgumentNullException>(() => new DataChangedMessage(null, DataChangeOperation.Created));
        }

        /// <summary>
        /// Tests that the domain wire name derivation is the lower case full
        /// name, which the addressing, the messages and the service islands
        /// all share.
        /// </summary>
        [Fact]
        public void DomainNameIsTheLowerCaseFullName()
        {
            Assert.Equal(typeof(FakeDomain).FullName.ToLower(), DataChangedNotifier.DomainName(typeof(FakeDomain)));
            Assert.Null(DataChangedNotifier.DomainName(null));
        }

        /// <summary>
        /// Tests that the domain address selects sessions carrying the domain
        /// regardless of casing and rejects sessions without it.
        /// </summary>
        [Fact]
        public void AddressDomainMatchesSessionsOfTheDomain()
        {
            var address = new AddressDomain("my.app.order");

            Assert.True(address.Matches(CreateSession("my.app.order")));
            Assert.True(address.Matches(CreateSession("My.App.Order")));
            Assert.False(address.Matches(CreateSession("my.app.customer")));
            Assert.False(address.Matches(CreateSession()));
            Assert.False(address.Matches(null));
        }

        /// <summary>
        /// Tests that the instance form and the type-safe form derive the same
        /// wire name as the notifier, so a change reaches the sessions a page
        /// or a scope subscribed under that name.
        /// </summary>
        [Fact]
        public void AddressDomainFormsAgreeOnTheWireName()
        {
            var session = CreateSession(typeof(FakeDomain).FullName.ToLower());

            Assert.True(new AddressDomain(new FakeDomain()).Matches(session));
            Assert.True(new AddressDomain<FakeDomain>().Matches(session));
        }

        /// <summary>
        /// Tests that a well formed subscribe message extends the subscription
        /// with its lower cased domains.
        /// </summary>
        [Fact]
        public void SubscriptionAddsTheDomainsOfASubscribeMessage()
        {
            var subscription = new DataSubscription();

            var handled = subscription.Handle(
                "{\"type\":\"webexpress.webapp.data.subscribe\",\"domains\":[\"My.App.Order\",\"my.app.customer\"]}");

            Assert.True(handled);
            Assert.Contains("my.app.order", subscription.Domains);
            Assert.Contains("my.app.customer", subscription.Domains);
        }

        /// <summary>
        /// Tests that subscriptions accumulate over multiple messages, because
        /// scopes mount independently and each announces its own domains.
        /// </summary>
        [Fact]
        public void SubscriptionAccumulatesOverMultipleMessages()
        {
            var subscription = new DataSubscription();

            subscription.Handle("{\"type\":\"webexpress.webapp.data.subscribe\",\"domains\":[\"a\"]}");
            subscription.Handle("{\"type\":\"webexpress.webapp.data.subscribe\",\"domains\":[\"b\"]}");

            Assert.Equal(2, subscription.Domains.Count());
        }

        /// <summary>
        /// Tests that payloads that are not a valid subscribe message are
        /// ignored, so a misbehaving client cannot disturb the socket pipeline.
        /// </summary>
        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("{\"type\":")]
        [InlineData("\"just a string\"")]
        [InlineData("{\"type\":\"webexpress.webapp.data.changed\",\"domains\":[\"a\"]}")]
        [InlineData("{\"type\":\"webexpress.webapp.data.subscribe\"}")]
        [InlineData("{\"type\":\"webexpress.webapp.data.subscribe\",\"domains\":\"a\"}")]
        [InlineData("{\"type\":\"webexpress.webapp.data.subscribe\",\"domains\":[]}")]
        [InlineData("{\"type\":\"webexpress.webapp.data.subscribe\",\"domains\":[42,\"  \"]}")]
        public void SubscriptionIgnoresInvalidPayloads(string payload)
        {
            var subscription = new DataSubscription();

            Assert.False(subscription.Handle(payload));
            Assert.Empty(subscription.Domains);
        }

        /// <summary>
        /// Tests the message family predicate that routes inbound payloads to
        /// the subscription handling.
        /// </summary>
        [Theory]
        [InlineData("webexpress.webapp.data.subscribe", true)]
        [InlineData("webexpress.webapp.data.changed", true)]
        [InlineData("webexpress.webapp.collaborative.cursor", false)]
        [InlineData(null, false)]
        public void MessageTypePredicateRecognizesTheFamily(string type, bool expected)
        {
            Assert.Equal(expected, DataChangedMessageTypes.IsDataChange(type));
        }

        /// <summary>
        /// Tests that the socket merges the runtime subscription into its
        /// session domains, so a scope that subscribes after the page rendered
        /// is addressed like a page that declared the domain up front.
        /// </summary>
        [Fact]
        public void SocketMergesSubscribedDomainsIntoItsSession()
        {
            var request = UnitTestControlFixture.CreateRequestMock();
            var socket = new TestMessageQueueSocket(Guid.NewGuid(), new FakeSocketContext(), null, request);

            Assert.DoesNotContain("my.app.order", socket.ClientSession.Domains);

            socket.DataSubscription.Handle(
                "{\"type\":\"webexpress.webapp.data.subscribe\",\"domains\":[\"my.app.order\"]}");

            Assert.Contains("my.app.order", socket.ClientSession.Domains);
        }

        /// <summary>
        /// Tests that the notifier ignores items that belong to no domain, so
        /// callers can pass their entity unconditionally.
        /// </summary>
        [Fact]
        public async Task NotifierIgnoresItemsWithoutADomain()
        {
            await DataChangedNotifier.NotifyAsync(new object(), DataChangeOperation.Updated, null, TestContext.Current.CancellationToken);
            await DataChangedNotifier.NotifyAsync(null, DataChangeOperation.Updated, null, TestContext.Current.CancellationToken);
        }

        /// <summary>
        /// Tests that the notifier survives a host without a message queue
        /// manager, because a change notification must never fail the data
        /// operation it follows.
        /// </summary>
        [Fact]
        public async Task NotifierSurvivesAMissingManager()
        {
            await DataChangedNotifier.NotifyAsync(new FakeDomain(), DataChangeOperation.Created, "1", TestContext.Current.CancellationToken);
            await DataChangedNotifier.NotifyAsync<FakeDomain>(DataChangeOperation.Deleted, null, TestContext.Current.CancellationToken);
        }

        /// <summary>
        /// Creates a minimal client session carrying only the domains the
        /// address inspects.
        /// </summary>
        private static FakeClientSession CreateSession(params string[] domains)
        {
            return new FakeClientSession
            {
                ConnectionId = Guid.NewGuid(),
                Domains = domains
            };
        }

        /// <summary>
        /// A concrete socket for exercising the session domain merge; the
        /// abstract base carries all behavior under test.
        /// </summary>
        private sealed class TestMessageQueueSocket : MessageQueueSocket
        {
            public TestMessageQueueSocket(Guid connectionId, ISocketContext socketContext, IMessageQueueManager messageQueueManager, IRequest request)
                : base(connectionId, socketContext, messageQueueManager, request)
            {
            }
        }

        /// <summary>
        /// A minimal socket context; the session merge only reads its scalar
        /// metadata.
        /// </summary>
        private sealed class FakeSocketContext : ISocketContext
        {
            public string SupportedSubProtocol => "wxmsg";
            public SocketMessageType MessageType => SocketMessageType.Text;
            public ulong? MaxMessageSize => null;
            public bool RequiresAuthentication => false;
            public IComponentId EndpointId => null;
            public IPluginContext PluginContext => null;
            public IApplicationContext ApplicationContext => null;
            public IEnumerable<WebExpress.WebCore.WebCondition.ICondition> Conditions => [];
            public bool Cache => false;
            public bool IncludeSubPaths => false;
            public WebExpress.WebCore.WebEndpoint.IRoute Route => null;
            public IEnumerable<Attribute> Attributes => [];
            public IEnumerable<WebExpress.WebCore.WebIdentity.IIdentityPolicy> Policies => [];
        }

        /// <summary>
        /// Minimal client session fake exposing only the fields the address
        /// inspects.
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
