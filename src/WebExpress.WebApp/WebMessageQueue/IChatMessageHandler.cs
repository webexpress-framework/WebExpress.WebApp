using System.Threading;
using System.Threading.Tasks;

namespace WebExpress.WebApp.WebMessageQueue
{
    /// <summary>
    /// Handles inbound chat control messages received over a
    /// <see cref="IMessageQueueSocket"/> connection. The handler covers
    /// both new chat messages and history replay requests.
    /// </summary>
    public interface IChatMessageHandler
    {
        /// <summary>
        /// Interprets and validates the specified inbound chat payload,
        /// then performs the appropriate server-side action (broadcast a
        /// chat message or replay the channel history back to the source).
        /// </summary>
        /// <param name="source">
        /// The socket that received the raw message. Cannot be <c>null</c>.
        /// </param>
        /// <param name="rawPayload">The raw text payload.</param>
        /// <param name="cancellationToken">
        /// A token that propagates notification of request cancellation.
        /// </param>
        Task HandleAsync
        (
            IMessageQueueSocket source,
            string rawPayload,
            CancellationToken cancellationToken = default
        );
    }
}
