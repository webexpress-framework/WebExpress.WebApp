using System;
using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using WebExpress.WebApp.WebMessageQueue.Model;
using WebExpress.WebCore;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebCluster;
using WebExpress.WebCore.WebComponent;

namespace WebExpress.WebApp.WebMessageQueue
{
    /// <summary>
    /// Manages the registration and invocation of message handlers for different message 
    /// types within the application.
    /// Provides functionality to register, unregister, and dispatch messages to 
    /// appropriate handlers.
    /// </summary>
    public sealed class MessageQueueManager : IMessageQueueManager
    {
        private readonly IComponentHub _componentHub;
        private readonly IHttpServerContext _httpServerContext;
        private readonly SubscriberDictionary _subscribers = new();
        private readonly SocketDictionary _connections = new();
        private readonly PopupNotificationDispatcher _popupNotificationDispatcher;
        private readonly IPopupNotificationHandler _popupNotificationHandler;
        private readonly ProgressTaskDispatcher _progressTaskDispatcher;
        private readonly SystemMetricsDispatcher _systemMetricsDispatcher;
        private readonly ChatChannelStore _chatChannelStore;
        private readonly IChatMessageHandler _chatMessageHandler;
        private readonly IDisposable _clusterSubscription;

        /// <summary>
        /// The topic messages for clients connected to other instances travel on.
        /// </summary>
        internal const string ClusterTopic = "webexpress.messagequeue";

        /// <summary>
        /// The form a message takes between instances: the recipients as data and the message
        /// as its clients receive it.
        /// </summary>
        /// <param name="Address">The recipients.</param>
        /// <param name="Json">The serialized message.</param>
        private sealed record ClusterEnvelope
        (
            [property: JsonPropertyName("address")] AddressDescriptor Address,
            [property: JsonPropertyName("json")] string Json
        );

        /// <summary>
        /// Gets the handler for inbound chat messages (send + history
        /// replay) over the WebSocket.
        /// </summary>
        public IChatMessageHandler ChatMessageHandler => _chatMessageHandler;

        /// <summary>
        /// Gets the popup notification dispatcher that bridges the
        /// <see cref="WebUI.WebNotification.NotificationManager"/> to this
        /// transport. Used by <see cref="MessageQueueSocket"/> to replay
        /// outstanding notifications on (re)connect.
        /// </summary>
        public PopupNotificationDispatcher PopupNotificationDispatcher => _popupNotificationDispatcher;

        /// <summary>
        /// Gets the handler for inbound popup control messages (currently
        /// the dismiss requests issued when a user closes a notification).
        /// </summary>
        public IPopupNotificationHandler PopupNotificationHandler => _popupNotificationHandler;

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="componentHub">The component hub.</param>
        /// <param name="httpServerContext">The reference to the context of the host.</param>
        [SuppressMessage("CodeQuality", "IDE0051:Remove unused private members", Justification = "Used via Reflection.")]
        private MessageQueueManager(IComponentHub componentHub, IHttpServerContext httpServerContext)
        {
            _componentHub = componentHub;
            _httpServerContext = httpServerContext;

            _httpServerContext?.Log?.Debug
            (
                I18N.Translate("webexpress.webcore:messagequeuemanager.initialization")
            );

            _popupNotificationDispatcher = new PopupNotificationDispatcher(this, _componentHub);
            _popupNotificationHandler = new PopupNotificationHandler(_componentHub);
            _progressTaskDispatcher = new ProgressTaskDispatcher(this, _componentHub);
            _systemMetricsDispatcher = new SystemMetricsDispatcher(this);
            _chatChannelStore = new ChatChannelStore(sharedStore: () => _componentHub?.ClusterManager?.Store is { IsShared: true } store ? store : null);
            _chatMessageHandler = new ChatMessageHandler(this, _chatChannelStore);
            _clusterSubscription = _componentHub?.ClusterManager?.Subscribe(ClusterTopic, OnClusterMessage);
        }

        /// <summary>
        /// Registers a MessageQueueSocket instance.
        /// </summary>
        /// <param name="connectionId">
        /// The associated connection ID providing connection information. Cannot be null.
        /// </param>
        /// <param name="socket">
        /// The IMessageQueueSocket instance to register.
        /// </param>
        /// <returns>
        /// The current instance for method chaining.
        /// </returns>
        public IMessageQueueManager Register(Guid connectionId, IMessageQueueSocket socket)
        {
            ArgumentNullException.ThrowIfNull(socket);

            _connections[connectionId] = socket;

            return this;
        }

        /// <summary>
        /// Registers a handler to be invoked when a message of the specified type is received.
        /// </summary>
        /// <param name="messageType">The type of message to subscribe to.</param>
        /// <param name="handler">
        /// The delegate to invoke when a message of the specified type is received.
        /// </param>
        /// <returns>The current instance for method chaining.</returns>
        public IMessageQueueManager Register(string messageType, Action<IMessage> handler)
        {
            ArgumentNullException.ThrowIfNull(handler);
            _subscribers.AddOrUpdate
            (
                messageType,
                _ => [handler],
                (_, list) =>
                {
                    lock (list)
                    {
                        list.Add(handler);
                    }
                    return list;
                }
            );

            return this;
        }

        /// <summary>
        /// Unregisters a previously registered socket instance.
        /// </summary>
        /// <param name="connectionId">
        /// The associated connection ID providing connection information. Cannot be null.
        /// </param>
        /// <returns>
        /// The current instance for method chaining.
        /// </returns>
        public IMessageQueueManager Unregister(Guid connectionId)
        {
            _connections.TryRemove(connectionId, out _);

            return this;
        }

        /// <summary>
        /// Unregisters a handler for a specific message type, so that it no longer 
        /// receives messages of that type.
        /// </summary>
        /// <remarks>If the specified handler is not registered for the given message type, 
        /// this method has no effect. This method is thread-safe.
        /// </remarks>
        /// <param name="messageType">
        /// The type of message for which the handler should be unregistered.
        /// </param>
        /// <param name="handler">
        /// The delegate to remove from the list of handlers for the specified message type. 
        /// </param>
        /// <returns>The current instance for method chaining.</returns>
        public IMessageQueueManager Unregister(string messageType, Action<IMessage> handler)
        {
            if (_subscribers.TryGetValue(messageType, out var list))
            {
                lock (list)
                {
                    list.Remove(handler);
                }
            }

            return this;
        }

        /// <summary>
        /// Sends a message from the server to all client sessions that match the 
        /// specified address. The MessageQueueManager evaluates the address, selects 
        /// the appropriate WebSocket sessions and forwards the serialized message 
        /// through the active connections.
        /// </summary>
        /// <param name="address">
        /// The addressing rule that determines which client sessions receive the message.
        /// </param>
        /// <param name="message">
        /// The message instance that is sent to the selected clients.
        /// </param>
        /// <param name="cancellationToken">
        /// A token that propagates notification of request cancellation.
        /// </param>
        /// <returns>
        /// The current instance to support method chaining.
        /// </returns>
        public async Task<IMessageQueueManager> SendAsync(IAddress address, IMessage message, CancellationToken cancellationToken = default)
        {
            ArgumentNullException.ThrowIfNull(address);
            ArgumentNullException.ThrowIfNull(message);

            Forward(address, message);

            await DeliverAsync(address, message, cancellationToken);

            return this;
        }

        /// <summary>
        /// Hands a message to the matching clients connected to this instance.
        /// </summary>
        /// <param name="address">The recipients.</param>
        /// <param name="message">The message.</param>
        /// <param name="cancellationToken">A token that propagates notification of request cancellation.</param>
        /// <returns>A task that completes once every matching client was tried.</returns>
        private async Task DeliverAsync(IAddress address, IMessage message, CancellationToken cancellationToken)
        {
            var closedSessions = new List<Guid>();

            foreach (var entry in _connections)
            {
                var sessionId = entry.Key;
                var session = entry.Value;

                // skip sessions that do not match the address
                if (!address.Matches(session?.ClientSession))
                {
                    continue;
                }

                try
                {
                    await session.SendAsync(message, cancellationToken);
                }
                catch
                {
                    // mark failed sessions for cleanup
                    closedSessions.Add(sessionId);
                }
            }

            // remove closed or failed sessions
            foreach (var id in closedSessions)
            {
                _connections.TryRemove(id, out _);
            }
        }

        /// <summary>
        /// Passes a message on to the other instances of a cluster, whose clients may match the
        /// address just as well. It is not awaited: the caller - often a request changing data -
        /// must not wait for other instances, and a lost live message only costs a refresh.
        /// </summary>
        /// <param name="address">The recipients.</param>
        /// <param name="message">The message.</param>
        private void Forward(IAddress address, IMessage message)
        {
            // a forwarded message stays on the instance it was forwarded to; passing it on again
            // would echo it around the cluster
            if (message is ForwardedMessage
                || _componentHub?.ClusterManager is not { Transport: not null } cluster
                || address.Describe() is not { } descriptor)
            {
                return;
            }

            var payload = JsonSerializer.SerializeToUtf8Bytes(new ClusterEnvelope(descriptor, message.ToJson()));

            _ = cluster.PublishAsync(ClusterTopic, payload);
        }

        /// <summary>
        /// Delivers a message another instance forwarded to the matching local clients.
        /// </summary>
        /// <param name="message">The cluster message.</param>
        private void OnClusterMessage(ClusterMessage message)
        {
            ClusterEnvelope envelope;

            try
            {
                envelope = JsonSerializer.Deserialize<ClusterEnvelope>(message.Payload);
            }
            catch (JsonException)
            {
                return;
            }

            if (envelope?.Address is null || string.IsNullOrEmpty(envelope.Json))
            {
                return;
            }

            _ = DeliverAsync(envelope.Address, new ForwardedMessage(envelope.Json), CancellationToken.None);
        }

        /// <summary>
        /// Replays every still-valid popup notification for the connecting
        /// socket. Forwards to <see cref="PopupNotificationDispatcher"/>.
        /// </summary>
        /// <param name="socket">The connecting socket.</param>
        /// <param name="cancellationToken">
        /// A token that propagates notification of request cancellation.
        /// </param>
        public Task ReplayPopupNotificationsAsync(IMessageQueueSocket socket, CancellationToken cancellationToken = default)
        {
            return _popupNotificationDispatcher.ReplayAsync(socket, cancellationToken);
        }

        /// <summary>
        /// Replays every active task as a progress task update to the
        /// connecting socket. Forwards to
        /// <see cref="ProgressTaskDispatcher"/>.
        /// </summary>
        /// <param name="socket">The connecting socket.</param>
        /// <param name="cancellationToken">
        /// A token that propagates notification of request cancellation.
        /// </param>
        public Task ReplayProgressTasksAsync(IMessageQueueSocket socket, CancellationToken cancellationToken = default)
        {
            return _progressTaskDispatcher.ReplayAsync(socket, cancellationToken);
        }

        /// <summary>
        /// Releases all resources used by the current instance of the class.
        /// </summary>
        public void Dispose()
        {
            _clusterSubscription?.Dispose();
            _systemMetricsDispatcher?.Dispose();

            GC.SuppressFinalize(this);
        }
    }
}
