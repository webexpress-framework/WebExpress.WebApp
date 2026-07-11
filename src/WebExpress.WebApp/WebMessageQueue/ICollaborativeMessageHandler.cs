using System.Threading;
using System.Threading.Tasks;

namespace WebExpress.WebApp.WebMessageQueue
{
    /// <summary>
    /// Handles collaborative messages (presence, cursor and input events) that
    /// are received over a <see cref="IMessageQueueSocket"/> connection.
    /// </summary>
    /// <remarks>
    /// The handler encapsulates the interpretation, validation and
    /// distribution of collaborative payloads so that the generic
    /// <see cref="MessageQueueSocket"/> implementation does not need to be
    /// aware of any concrete message type. Additional message families can be
    /// introduced through analogous handler classes without modifying the
    /// underlying socket infrastructure.
    /// </remarks>
    public interface ICollaborativeMessageHandler
    {
        /// <summary>
        /// Interprets, validates and forwards the specified collaborative
        /// payload to all clients that are part of the same collaboration
        /// group as the originating socket.
        /// </summary>
        /// <param name="source">
        /// The socket that received the raw message. Used to derive routing
        /// information such as the originating connection id and the
        /// associated domains. Cannot be <c>null</c>.
        /// </param>
        /// <param name="rawPayload">
        /// The raw text payload as received from the client. Cannot be
        /// <c>null</c>.
        /// </param>
        /// <param name="cancellationToken">
        /// A token that propagates notification of request cancellation.
        /// </param>
        /// <returns>
        /// A task that represents the asynchronous handling operation. The
        /// task completes once the message has been broadcast to all matching
        /// peers.
        /// </returns>
        Task HandleAsync
        (
            IMessageQueueSocket source,
            string rawPayload,
            CancellationToken cancellationToken = default
        );
    }
}
