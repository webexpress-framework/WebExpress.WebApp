using System;
using System.Threading.Tasks;
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
        private ISocketConnection _socketConnection;

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
        public MessageQueueSocket(Guid connectionId, ISocketContext socketContext, IMessageQueueManager messageQueueManager)
        {
            _connectionId = connectionId;
            _socketContext = socketContext;
            _messageQueueManager = messageQueueManager;
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
        /// <returns>A task that represents the asynchronous send operation.</returns>
        public async Task Send(IMessage message)
        {
            await _socketConnection?.SendTextAsync(message.ToJson());
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
