using System;
using WebExpress.WebApp.WebMessageQueue;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebEndpoint;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebSocket;

namespace WebExpress.WebApp.WWW.Ws
{
    /// <summary>
    /// Represents a message queue socket for sending and receiving messages within
    /// a messaging infrastructure.
    /// </summary>
    /// <remarks>
    /// Every page of a WebApp connects to the queue, those that work without signing in
    /// included, so the handshake is open to everybody. What a connection receives is decided
    /// per message instead: notifications and progress reach only the own session, metrics only
    /// a caller with system access, a chat channel only a signed-in caller allowed in it, a
    /// collaborative document only a holder of the token its page issued, and a data change
    /// carries no more than the domain, the operation and the id of the item.
    /// </remarks>
    [SubProtocol("wxmsg")]
    public sealed class MessageQueue : MessageQueueSocket, IPublicEndpoint
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
        /// <param name="request">The request.</param>
        public MessageQueue(Guid connectionId, ISocketContext socketContext, IMessageQueueManager messageQueueManager, IRequest request)
            : base(connectionId, socketContext, messageQueueManager, request)
        {
        }
    }
}
