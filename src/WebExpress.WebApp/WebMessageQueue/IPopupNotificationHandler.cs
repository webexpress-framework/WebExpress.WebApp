using System.Threading;
using System.Threading.Tasks;

namespace WebExpress.WebApp.WebMessageQueue
{
    /// <summary>
    /// Handles popup notification control messages received over a
    /// <see cref="IMessageQueueSocket"/> connection. Today the only inbound
    /// popup message is a dismiss request issued when the user closes a
    /// notification on the client side.
    /// </summary>
    public interface IPopupNotificationHandler
    {
        /// <summary>
        /// Interprets and validates the specified inbound popup payload,
        /// then performs the resulting server-side action (currently
        /// <c>NotificationManager.RemoveNotifications</c> on dismiss).
        /// </summary>
        /// <param name="source">
        /// The socket that received the raw message. Used to derive routing
        /// information such as the originating session.
        /// </param>
        /// <param name="rawPayload">The raw text payload from the client.</param>
        /// <param name="cancellationToken">
        /// A token that propagates notification of request cancellation.
        /// </param>
        /// <returns>
        /// A task that represents the asynchronous handling operation.
        /// </returns>
        Task HandleAsync
        (
            IMessageQueueSocket source,
            string rawPayload,
            CancellationToken cancellationToken = default
        );
    }
}
