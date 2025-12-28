using System;
using WebExpress.WebApp.WebMessageQueue;
using WebExpress.WebCore.WebSocket;

namespace WebExpress.WebApp.WWW.Ws
{
    /// <summary>
    /// Represents a message queue socket for sending and receiving messages within 
    /// a messaging infrastructure.
    /// </summary>
    public sealed class MessageQueue : MessageQueueSocket
    {
        /// <summary>
        /// Initializes a new instance of the MessageQueue class with the specified socket 
        /// context and message queue manager.
        /// </summary>
        /// <param name="connectionId">
        /// The associated connection Id providing connection information. Cannot be null.
        /// </param>
        /// <param name="socketContext">
        /// The socket context used to manage the underlying socket connection for the 
        /// message queue. Cannot be null.
        /// </param>
        /// <param name="messageQueueManager">
        /// The message queue manager responsible for handling message queue 
        /// operations. Cannot be null.
        /// </param>
        public MessageQueue(Guid connectionId, ISocketContext socketContext, IMessageQueueManager messageQueueManager)
            : base(connectionId, socketContext, messageQueueManager)
        {
        }
    }
}
