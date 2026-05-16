using System;
using System.Threading;
using System.Threading.Tasks;
using WebExpress.WebCore.WebComponent;
using WebExpress.WebUI.WebNotification;

namespace WebExpress.WebApp.WebMessageQueue
{
    /// <summary>
    /// Bridges the existing <see cref="NotificationManager"/> to the
    /// WebSocket-based <see cref="IMessageQueueManager"/>. New notifications
    /// are pushed live to all matching clients, and every still-active
    /// notification is replayed when a client (re)connects so that messages
    /// sent during an offline phase are not lost.
    /// </summary>
    public sealed class PopupNotificationDispatcher
    {
        private readonly IMessageQueueManager _messageQueueManager;
        private readonly IComponentHub _componentHub;
        private NotificationManager _notificationManager;
        private bool _subscribed;

        /// <summary>
        /// Initializes a new instance and subscribes to the notification
        /// manager's dispatch event so live notifications start flowing
        /// through the message queue.
        /// </summary>
        /// <param name="messageQueueManager">
        /// The message queue manager used to forward notifications.
        /// </param>
        /// <param name="componentHub">
        /// The component hub used to resolve <see cref="NotificationManager"/>.
        /// </param>
        public PopupNotificationDispatcher
        (
            IMessageQueueManager messageQueueManager,
            IComponentHub componentHub
        )
        {
            _messageQueueManager = messageQueueManager
                ?? throw new ArgumentNullException(nameof(messageQueueManager));
            _componentHub = componentHub
                ?? throw new ArgumentNullException(nameof(componentHub));

            TryAttach();
        }

        /// <summary>
        /// Sends every still-valid notification that is visible to the
        /// originating session of <paramref name="socket"/> to that specific
        /// connection. Called from <c>MessageQueueSocket.OnConnectedAsync</c>
        /// so a freshly connecting (or reconnecting) client receives every
        /// message it missed while offline.
        /// </summary>
        /// <param name="socket">The connecting socket.</param>
        /// <param name="cancellationToken">
        /// A token that propagates notification of request cancellation.
        /// </param>
        public async Task ReplayAsync(IMessageQueueSocket socket, CancellationToken cancellationToken = default)
        {
            ArgumentNullException.ThrowIfNull(socket);

            TryAttach();
            if (_notificationManager == null)
            {
                return;
            }

            var session = socket.ClientSession;
            var applicationContext = session?.ApplicationContext;
            if (applicationContext == null)
            {
                return;
            }

            // The request stored on the socket carries both the session and
            // the application context, which is exactly what
            // NotificationManager.GetNotifications expects. The notification
            // manager API takes the concrete Request type; for any other
            // implementation we skip the session-scoped replay.
            var request = (socket as MessageQueueSocket)?.Request as WebCore.WebMessage.Request;
            if (request == null)
            {
                return;
            }

            foreach (var notification in _notificationManager.GetNotifications(applicationContext, request))
            {
                if (!IsStillValid(notification))
                {
                    continue;
                }

                var message = new PopupNotificationMessage(notification, applicationContext.ApplicationId);

                try
                {
                    await socket.SendAsync(message, cancellationToken);
                }
                catch
                {
                    // a single dead connection must not break the replay
                }
            }
        }

        /// <summary>
        /// Subscribes to <see cref="NotificationManager.DispatchNotification"/>
        /// if the manager is available. The hub may instantiate managers
        /// lazily, so the call is idempotent and retried on every entry
        /// point.
        /// </summary>
        private void TryAttach()
        {
            if (_subscribed)
            {
                return;
            }

            _notificationManager = _componentHub?.GetComponentManager<NotificationManager>();
            if (_notificationManager == null)
            {
                return;
            }

            _notificationManager.DispatchNotification += OnDispatchNotification;
            _subscribed = true;
        }

        /// <summary>
        /// Forwards a freshly created notification through the message
        /// queue. Session-scoped notifications target only the session of
        /// the originating request; global notifications go to every client
        /// of the application.
        /// </summary>
        private async void OnDispatchNotification(object sender, NotificationDispatchEventArgs args)
        {
            if (args?.Notification == null || args.ApplicationContext == null)
            {
                return;
            }

            try
            {
                IAddress address = args.Session != null
                    ? new AddressSession(args.Session)
                    : new AddressApplication(args.ApplicationContext);

                var message = new PopupNotificationMessage
                (
                    args.Notification,
                    args.ApplicationContext.ApplicationId
                );

                await _messageQueueManager.SendAsync(address, message);
            }
            catch
            {
                // swallow - never let a transport error tear down the
                // notification manager event pipeline
            }
        }

        /// <summary>
        /// Returns <c>true</c> if the notification has not yet expired.
        /// A negative <see cref="INotification.Durability"/> means
        /// indefinite lifetime.
        /// </summary>
        private static bool IsStillValid(INotification notification)
        {
            if (notification.Durability < 0)
            {
                return true;
            }
            return notification.Created.AddMilliseconds(notification.Durability) >= DateTime.Now;
        }
    }
}
