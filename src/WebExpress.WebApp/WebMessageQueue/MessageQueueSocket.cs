using System;
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
        private ISocketConnection _socketConnection;

        /// <summary>
        /// Returns the client session associated with the current context.
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
            ApplicationContext = _socketContext.ApplicationContext
        };

        /// <summary>
        /// Returns the unique identifier for the current connection.
        /// </summary>
        public Guid ConnectionId => _connectionId;

        /// <summary>
        /// Returns the context associated with the underlying socket connection.
        /// </summary>
        public ISocketContext SocketContext => _socketContext;

        /// <summary>
        /// Returns the request associated with the current operation.
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
        /// Handles an incoming text message received by the component.
        /// </summary>
        /// <param name="obj">The text message content to process. Cannot be null.</param>
        private void OnTextMessageReceived(string obj)
        {
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
