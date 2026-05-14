using System;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebSocket;

namespace WebExpress.WebApp.WebMessageQueue
{
    /// <summary>
    /// Represents an abstract socket that integrates with a message queue system for
    /// handling socket communication events.
    /// </summary>
    public abstract class MessageQueueSocket : IMessageQueueSocket
    {
        private readonly Guid _connectionId;
        private readonly ISocketContext _socketContext;
        private readonly IMessageQueueManager _messageQueueManager;
        private readonly IRequest _request;
        private readonly ICollaborativeMessageHandler _collaborativeHandler;
        private readonly IPopupNotificationHandler _popupNotificationHandler;
        private ISocketConnection _socketConnection;

        /// <summary>
        /// Gets the client session associated with the current context.
        /// </summary>
        public IClientSession ClientSession => new ClientSession()
        {
            Method = _request.Method,
            Uri = _request?.Uri,
            Session = _request.Session,
            Header = _request.Header,
            RemoteEndPoint = _request.RemoteEndPoint,
            Culture = _request.Culture,
            Parameters = _request.Parameters,
            SupportedSubProtocol = _socketContext.SupportedSubProtocol,
            ConnectionId = _connectionId,
            EndpointId = _socketContext.EndpointId,
            PluginContext = _socketContext.PluginContext,
            ApplicationContext = _socketContext.ApplicationContext,
            Domains = _request.Parameters.FirstOrDefault()?.Value?.Split(';') ?? []
        };

        /// <summary>
        /// Gets the unique identifier for the current connection.
        /// </summary>
        public Guid ConnectionId => _connectionId;

        /// <summary>
        /// Gets the context associated with the underlying socket connection.
        /// </summary>
        public ISocketContext SocketContext => _socketContext;

        /// <summary>
        /// Gets the request associated with the current operation.
        /// </summary>
        public IRequest Request => _request;

        /// <summary>
        /// Initializes a new instance of the MessageQueueSocket class using the specified
        /// socket context and message queue manager.
        /// </summary>
        /// <param name="connectionId">
        /// The associated connection Id providing connection information. Cannot be null.
        /// </param>
        /// <param name="socketContext">
        /// The socket context that manages the underlying socket operations for this instance.
        /// </param>
        /// <param name="messageQueueManager">
        /// The message queue manager responsible for handling message queuing and delivery.
        /// </param>
        /// <param name="request">The request.</param>
        public MessageQueueSocket(Guid connectionId, ISocketContext socketContext, IMessageQueueManager messageQueueManager, IRequest request)
        {
            _connectionId = connectionId;
            _socketContext = socketContext;
            _messageQueueManager = messageQueueManager;
            _request = request;
            _collaborativeHandler = messageQueueManager is not null
                ? new CollaborativeMessageHandler(messageQueueManager)
                : null;
            _popupNotificationHandler = messageQueueManager?.PopupNotificationHandler;
        }

        /// <summary>
        /// Handles logic to be executed when a new connection is established asynchronously.
        /// </summary>
        /// <param name="socketConnection">The socket connection.</param>
        /// <returns>
        /// A task that represents the asynchronous operation.
        /// </returns>
        public virtual async Task OnConnectedAsync(ISocketConnection socketConnection)
        {
            _socketConnection = socketConnection;
            _messageQueueManager?.Register(_connectionId, this);

            _socketConnection.Disconnected += OnDisconnected;
            _socketConnection.TextMessageReceived += OnTextMessageReceived;

            // Replay all still-valid popup notifications for this session so
            // that messages issued during an offline phase (or before the
            // current page navigation) are delivered immediately.
            if (_messageQueueManager is not null)
            {
                try
                {
                    await _messageQueueManager.ReplayPopupNotificationsAsync(this);
                }
                catch
                {
                    // never let replay break the initial handshake
                }

                // Replay the snapshot of every active task so the client
                // receives the current state of any long-running operation
                // immediately on (re)connect — even when it joined after the
                // task already started.
                try
                {
                    await _messageQueueManager.ReplayProgressTasksAsync(this);
                }
                catch
                {
                    // never let replay break the initial handshake
                }
            }
        }

        /// <summary>
        /// Handles logic to be performed when the socket connection is closed.
        /// </summary>
        /// <param name="obj">
        /// Information about the reason and context for the socket closure.
        /// </param>
        private void OnDisconnected(SocketCloseInfo obj)
        {
            _messageQueueManager?.Unregister(_connectionId);
        }

        /// <summary>
        /// Handles an incoming text message received by the component. The socket
        /// inspects the envelope to determine the message type and delegates the
        /// actual processing to a specialized handler. This keeps the socket
        /// implementation generic and allows additional message families to be
        /// added without touching the transport.
        /// </summary>
        /// <param name="obj">The text message content to process. Cannot be null.</param>
        private void OnTextMessageReceived(string obj)
        {
            if (string.IsNullOrWhiteSpace(obj))
            {
                return;
            }

            if (!TryReadMessageType(obj, out var messageType))
            {
                return;
            }

            if (CollaborativeMessageTypes.IsCollaborative(messageType) && _collaborativeHandler is not null)
            {
                _ = DispatchCollaborativeAsync(obj);
                return;
            }

            if (PopupNotificationMessageTypes.IsPopup(messageType) && _popupNotificationHandler is not null)
            {
                _ = DispatchPopupAsync(obj);
            }
        }

        /// <summary>
        /// Forwards the raw payload to the popup notification handler. Like
        /// <see cref="DispatchCollaborativeAsync"/>, exceptions are swallowed
        /// so that a single malformed message cannot tear down the socket.
        /// </summary>
        /// <param name="rawPayload">The raw text payload.</param>
        private async Task DispatchPopupAsync(string rawPayload)
        {
            try
            {
                await _popupNotificationHandler
                    .HandleAsync(this, rawPayload, CancellationToken.None);
            }
            catch
            {
                // intentionally swallowed
            }
        }

        /// <summary>
        /// Reads the application defined message type from the raw JSON envelope
        /// without materializing the full payload. The lightweight inspection
        /// avoids unnecessary allocations for messages that the socket does not
        /// route to a handler.
        /// </summary>
        /// <param name="rawPayload">The raw text payload.</param>
        /// <param name="messageType">The extracted message type on success.</param>
        /// <returns>
        /// <c>true</c> if the payload exposes a non-empty <c>type</c> field;
        /// otherwise <c>false</c>.
        /// </returns>
        private static bool TryReadMessageType(string rawPayload, out string messageType)
        {
            messageType = null;

            try
            {
                using var document = JsonDocument.Parse(rawPayload);

                if (document.RootElement.ValueKind != JsonValueKind.Object)
                {
                    return false;
                }

                if (!document.RootElement.TryGetProperty("type", out var typeProperty)
                    || typeProperty.ValueKind != JsonValueKind.String)
                {
                    return false;
                }

                messageType = typeProperty.GetString();
            }
            catch (JsonException)
            {
                return false;
            }

            return !string.IsNullOrEmpty(messageType);
        }

        /// <summary>
        /// Forwards the raw payload to the collaborative handler. Exceptions
        /// raised by the handler are intentionally swallowed so that a single
        /// malformed message cannot tear down the socket connection.
        /// </summary>
        /// <param name="rawPayload">The raw text payload.</param>
        private async Task DispatchCollaborativeAsync(string rawPayload)
        {
            try
            {
                await _collaborativeHandler
                    .HandleAsync(this, rawPayload, CancellationToken.None);
            }
            catch
            {
                // intentionally swallowed; a misbehaving peer must not be able
                // to break the transport for everyone else.
            }
        }

        /// <summary>
        /// Sends the specified message to its intended recipient or destination.
        /// </summary>
        /// <param name="message">The message to send. Cannot be null.</param>
        /// <param name="cancellationToken">A token that propagates notification of request cancellation.</param>
        /// <returns>A task that represents the asynchronous send operation.</returns>
        public async Task SendAsync(IMessage message, CancellationToken cancellationToken = default)
        {
            await _socketConnection?.SendTextAsync(message.ToJson(), cancellationToken);
        }

        /// <summary>
        /// Releases all resources used by the current instance.
        /// </summary>
        public virtual void Dispose()
        {
            _messageQueueManager?.Unregister(_connectionId);

            GC.SuppressFinalize(this);
        }
    }
}
