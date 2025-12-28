using System;
using System.Threading;
using System.Threading.Tasks;
using WebExpress.WebCore.WebSocket;
using WebExpress.WebCore.WebSocket.Protocol;

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
        /// <param name="connectMessage">
        /// An optional message containing information about the connection request. May be 
        /// null if no message is provided.
        /// </param>
        /// <param name="cancellationToken">
        /// A cancellation token that can be used to cancel the asynchronous operation.
        /// </param>
        /// <returns>
        /// A task that represents the asynchronous operation.
        /// </returns>
        public virtual async Task OnConnectedAsync(ISocketMessage connectMessage = null, CancellationToken cancellationToken = default)
        {
            _messageQueueManager?.Register(_connectionId, this);
        }

        /// <summary>
        /// Handles an incoming socket message asynchronously. Override this method to 
        /// implement custom message processing logic.
        /// </summary>
        /// <param name="message">
        /// The message received from the socket to be processed. Cannot be null.
        /// </param>
        /// <param name="cancellationToken">
        /// A cancellation token that can be used to cancel the asynchronous operation.
        /// </param>
        /// <returns>
        /// A task that represents the asynchronous message handling operation.
        /// </returns>
        public virtual async Task OnReceiveAsync(ISocketMessage message, CancellationToken cancellationToken = default)
        {
            throw new NotImplementedException();
        }

        /// <summary>
        /// Handles an error that occurs during asynchronous processing.
        /// </summary>
        /// <param name="exception">
        /// The exception that was thrown during processing. Cannot be null.
        /// </param>
        /// <returns>
        /// A task that represents the asynchronous error handling operation.
        /// </returns>
        public virtual async Task OnErrorAsync(Exception exception)
        {
        }

        /// <summary>
        /// Invoked when a connection is disconnected. Override this method to perform 
        /// operations when a client disconnects from the socket.
        /// </summary>
        /// <param name="closeInfo">
        /// Information about the reason and context for the disconnection.
        /// </param>
        /// <returns>
        /// A task that represents the asynchronous operation.
        /// </returns>
        public virtual async Task OnDisconnectedAsync(SocketCloseInfo closeInfo)
        {
            _messageQueueManager?.Unregister(_connectionId);
        }

        /// <summary>
        /// Releases all resources used by the current instance.
        /// </summary>
        public virtual void Dispose()
        {
            GC.SuppressFinalize(this);
        }
    }
}
