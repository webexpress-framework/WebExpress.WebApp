using System;
using System.Threading;
using System.Threading.Tasks;
using WebExpress.WebCore.WebComponent;

namespace WebExpress.WebApp.WebMessageQueue
{
    /// <summary>
    /// Manages the registration and invocation of message handlers for different message 
    /// types within the application.
    /// Provides functionality to register, unregister, and dispatch messages to 
    /// appropriate handlers.
    /// </summary>
    public interface IMessageQueueManager : IComponentManager
    {
        /// <summary>
        /// Registers a MessageQueueSocket instance.
        /// </summary>
        /// <param name="connectionId">
        /// The associated connection Id providing connection information. Cannot be null.
        /// </param>
        /// <param name="socket">
        /// The IMessageQueueSocket instance to register.
        /// </param>
        /// <returns>The current instance for method chaining.</returns>
        IMessageQueueManager Register(Guid connectionId, IMessageQueueSocket socket);

        /// <summary>
        /// Registers a handler to be invoked when a message of the specified type is received.
        /// </summary>
        /// <param name="messageType">The type of message to subscribe to.</param>
        /// <param name="handler">
        /// The delegate to invoke when a message of the specified type is received.
        /// </param>
        /// <returns>The current instance for method chaining.</returns>
        IMessageQueueManager Register(string messageType, Action<IMessage> handler);

        /// <summary>
        /// Unregisters a previously registered socket instance.
        /// </summary>
        /// /// <param name="connectionId">
        /// The associated connection Id providing connection information. Cannot be null.
        /// </param>
        /// <returns>The current instance for method chaining.</returns>
        IMessageQueueManager Unregister(Guid connectionId);

        /// <summary>
        /// Unregisters a handler for a specific message type, so that it no longer 
        /// receives messages of that type.
        /// </summary>
        /// <remarks>If the specified handler is not registered for the given message type, 
        /// this method has no effect. This method is thread-safe.
        /// </remarks>
        /// <param name="messageType">
        /// The type of message for which the handler should be unregistered.
        /// </param>
        /// <param name="handler">
        /// The delegate to remove from the list of handlers for the specified message type. 
        /// </param>
        /// <returns>The current instance for method chaining.</returns>
        IMessageQueueManager Unregister(string messageType, Action<IMessage> handler);

        /// <summary>
        /// Sends a message from the server to all client sessions that match the 
        /// specified address. The MessageQueueManager evaluates the address, selects 
        /// the appropriate WebSocket sessions and forwards the serialized message 
        /// through the active connections.
        /// </summary>
        /// <param name="address">
        /// The addressing rule that determines which client sessions receive the message.
        /// </param>
        /// <param name="message">
        /// The message instance that is sent to the selected clients.
        /// </param>
        /// <param name="cancellationToken">
        /// A token that propagates notification of request cancellation.
        /// </param>
        /// <returns>
        /// The current instance to support method chaining.
        /// </returns>
        Task<IMessageQueueManager> SendAsync(IAddress address, IMessage message, CancellationToken cancellationToken = default);

        /// <summary>
        /// Sends every still-valid popup notification visible to the given
        /// socket's session/application back through that socket. Called
        /// from <c>MessageQueueSocket.OnConnectedAsync</c> so a freshly
        /// connecting or reconnecting client receives notifications it
        /// missed while offline.
        /// </summary>
        /// <param name="socket">The (re)connecting socket.</param>
        /// <param name="cancellationToken">
        /// A token that propagates notification of request cancellation.
        /// </param>
        Task ReplayPopupNotificationsAsync(IMessageQueueSocket socket, CancellationToken cancellationToken = default);

        /// <summary>
        /// Gets the handler for inbound popup control messages such as
        /// dismiss requests. May be <c>null</c> when popup notifications
        /// are not configured.
        /// </summary>
        IPopupNotificationHandler PopupNotificationHandler { get; }

        /// <summary>
        /// Sends the current state of every active task back through the
        /// connecting socket so a freshly arriving client receives the
        /// snapshot of every long-running operation it would otherwise
        /// miss.
        /// </summary>
        /// <param name="socket">The (re)connecting socket.</param>
        /// <param name="cancellationToken">
        /// A token that propagates notification of request cancellation.
        /// </param>
        Task ReplayProgressTasksAsync(IMessageQueueSocket socket, CancellationToken cancellationToken = default);
    }
}
