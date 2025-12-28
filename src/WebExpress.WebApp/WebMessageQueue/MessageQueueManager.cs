using System;
using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;
using WebExpress.WebApp.WebMessageQueue.Model;
using WebExpress.WebCore;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebComponent;
using WebExpress.WebCore.WebSocket.Protocol;

namespace WebExpress.WebApp.WebMessageQueue
{
    /// <summary>
    /// Manages the registration and invocation of message handlers for different message 
    /// types within the application.
    /// Provides functionality to register, unregister, and dispatch messages to 
    /// appropriate handlers.
    /// </summary>
    public sealed class MessageQueueManager : IMessageQueueManager
    {
        private readonly IComponentHub _componentHub;
        private readonly IHttpServerContext _httpServerContext;
        private readonly SubscriberDictionary _subscribers = new();
        private readonly SocketDictionary _connections = new();

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="componentHub">The component hub.</param>
        /// <param name="httpServerContext">The reference to the context of the host.</param>
        [SuppressMessage("CodeQuality", "IDE0051:Remove unused private members", Justification = "Used via Reflection.")]
        private MessageQueueManager(IComponentHub componentHub, IHttpServerContext httpServerContext)
        {
            _componentHub = componentHub;
            _httpServerContext = httpServerContext;

            _httpServerContext.Log.Debug
            (
                I18N.Translate("webexpress.webcore:messagequeuemanager.initialization")
            );
        }

        /// <summary>
        /// Registers a MessageQueueSocket instance.
        /// </summary>
        /// <param name="connectionId">
        /// The associated connection ID providing connection information. Cannot be null.
        /// </param>
        /// <param name="socket">
        /// The IMessageQueueSocket instance to register.
        /// </param>
        /// <returns>
        /// The current instance for method chaining.
        /// </returns>
        public IMessageQueueManager Register(Guid connectionId, IMessageQueueSocket socket)
        {
            ArgumentNullException.ThrowIfNull(socket);

            _connections[connectionId] = socket;

            return this;
        }

        /// <summary>
        /// Registers a handler to be invoked when a message of the specified type is received.
        /// </summary>
        /// <param name="messageType">The type of message to subscribe to.</param>
        /// <param name="handler">
        /// The delegate to invoke when a message of the specified type is received.
        /// </param>
        /// <returns>The current instance for method chaining.</returns>
        public IMessageQueueManager Register(string messageType, Action<ISocketMessage> handler)
        {
            ArgumentNullException.ThrowIfNull(handler);
            _subscribers.AddOrUpdate
            (
                messageType,
                _ => [handler],
                (_, list) =>
                {
                    lock (list)
                    {
                        list.Add(handler);
                    }
                    return list;
                }
            );

            return this;
        }

        /// <summary>
        /// Unregisters a previously registered socket instance.
        /// </summary>
        /// <param name="connectionId">
        /// The associated connection ID providing connection information. Cannot be null.
        /// </param>
        /// <returns>
        /// The current instance for method chaining.
        /// </returns>
        public IMessageQueueManager Unregister(Guid connectionId)
        {
            _connections.TryRemove(connectionId, out _);

            return this;
        }

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
        public IMessageQueueManager Unregister(string messageType, Action<ISocketMessage> handler)
        {
            if (_subscribers.TryGetValue(messageType, out var list))
            {
                lock (list)
                {
                    list.Remove(handler);
                }
            }

            return this;
        }

        /// <summary>
        /// Sends the specified message through the socket connection.
        /// </summary>
        /// <param name="message">The message to send.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IMessageQueueManager SendMessage(ISocketMessage message)
        {
            ProcessMessage(message);

            return this;
        }

        /// <summary>
        /// Invokes all registered handlers for the specified socket message type.
        /// </summary>
        /// <param name="message">The socket message to process. Cannot be null.</param>
        private void ProcessMessage(ISocketMessage message)
        {
            ArgumentNullException.ThrowIfNull(message);

            if (_subscribers.TryGetValue(message.Type, out var list))
            {
                // kopie erstellen, um konkurrierende listenänderungen zu vermeiden
                List<Action<ISocketMessage>> handlers;
                lock (list)
                {
                    handlers = [.. list];
                }

                foreach (var handler in handlers)
                {
                    try
                    {
                        handler(message);
                    }
                    catch (Exception ex)
                    {
                        // exceptions im handler dürfen nicht den gesamtprozess crashen
                        _httpServerContext.Log?.Error($"Exception in message handler: {ex}");
                    }
                }
            }
        }

        /// <summary>
        /// Releases all resources used by the current instance of the class.
        /// </summary>
        public void Dispose()
        {
            GC.SuppressFinalize(this);
        }
    }
}
