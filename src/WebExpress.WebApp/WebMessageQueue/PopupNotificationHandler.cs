using System;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using WebExpress.WebCore.WebComponent;
using WebExpress.WebUI.WebNotification;

namespace WebExpress.WebApp.WebMessageQueue
{
    /// <summary>
    /// Default implementation of <see cref="IPopupNotificationHandler"/>.
    /// Parses a dismiss payload coming from the client and removes the
    /// corresponding notification from <see cref="NotificationManager"/> so
    /// that it is not replayed on the next reconnect.
    /// </summary>
    public sealed class PopupNotificationHandler : IPopupNotificationHandler
    {
        private readonly IComponentHub _componentHub;

        /// <summary>
        /// Initializes a new instance of the
        /// <see cref="PopupNotificationHandler"/> class.
        /// </summary>
        /// <param name="componentHub">
        /// The component hub used to resolve <see cref="NotificationManager"/>.
        /// Cannot be <c>null</c>.
        /// </param>
        public PopupNotificationHandler(IComponentHub componentHub)
        {
            _componentHub = componentHub
                ?? throw new ArgumentNullException(nameof(componentHub));
        }

        /// <summary>
        /// Interprets a dismiss payload and removes the referenced
        /// notification from the server-side notification store.
        /// </summary>
        /// <param name="source">The originating socket.</param>
        /// <param name="rawPayload">The raw text payload.</param>
        /// <param name="cancellationToken">
        /// A token that propagates notification of request cancellation.
        /// </param>
        public Task HandleAsync
        (
            IMessageQueueSocket source,
            string rawPayload,
            CancellationToken cancellationToken = default
        )
        {
            ArgumentNullException.ThrowIfNull(source);

            if (string.IsNullOrWhiteSpace(rawPayload))
            {
                return Task.CompletedTask;
            }

            if (!TryParseDismiss(rawPayload, out var type, out var notificationId))
            {
                return Task.CompletedTask;
            }

            if (type != PopupNotificationMessageTypes.Dismiss)
            {
                return Task.CompletedTask;
            }

            var manager = _componentHub.GetComponentManager<NotificationManager>();
            manager?.RemoveNotifications(notificationId);

            return Task.CompletedTask;
        }

        /// <summary>
        /// Parses the dismiss envelope. Only the <c>type</c> and
        /// <c>notificationId</c> fields are required.
        /// </summary>
        private static bool TryParseDismiss(string rawPayload, out string type, out Guid notificationId)
        {
            type = null;
            notificationId = Guid.Empty;

            JsonDocument document;
            try
            {
                document = JsonDocument.Parse(rawPayload);
            }
            catch (JsonException)
            {
                return false;
            }

            using (document)
            {
                var root = document.RootElement;
                if (root.ValueKind != JsonValueKind.Object)
                {
                    return false;
                }

                if (!root.TryGetProperty("type", out var typeProperty)
                    || typeProperty.ValueKind != JsonValueKind.String)
                {
                    return false;
                }

                type = typeProperty.GetString();

                if (!root.TryGetProperty("notificationId", out var idProperty)
                    || idProperty.ValueKind != JsonValueKind.String)
                {
                    return false;
                }

                return Guid.TryParse(idProperty.GetString(), out notificationId);
            }
        }
    }
}
