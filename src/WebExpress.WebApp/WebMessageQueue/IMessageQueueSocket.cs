using System.Threading;
using System.Threading.Tasks;
using WebExpress.WebCore.WebSocket;

namespace WebExpress.WebApp.WebMessageQueue
{
    /// <summary>
    /// Represents a socket that provides message-based communication over a queue.
    /// </summary>
    public interface IMessageQueueSocket : ISocket
    {
        /// <summary>
        /// Gets the client session associated with the current context.
        /// </summary>
        IClientSession ClientSession { get; }

        /// <summary>
        /// Sends the specified message to its intended recipient or destination.
        /// </summary>
        /// <param name="message">The message to send. Cannot be null.</param>
        /// <param name="cancellationToken">A token that propagates notification of request cancellation.</param>
        /// <returns>A task that represents the asynchronous send operation.</returns>
        Task SendAsync(IMessage message, CancellationToken cancellationToken = default);
    }
}
