using System;
using System.Threading;
using System.Threading.Tasks;
using WebExpress.WebCore;
using WebExpress.WebCore.WebDomain;

namespace WebExpress.WebApp.WebMessageQueue
{
    /// <summary>
    /// The single entry point through which the backend announces a data
    /// change to the connected clients. The REST CRUD endpoints call it after
    /// a successful create, update or delete, and application code calls it
    /// for changes that happen outside a request, for example in a background
    /// job, so every change reaches the clients through one channel regardless
    /// of its origin. The notification is addressed by domain, so only the
    /// sessions that subscribed the changed domain receive it.
    /// </summary>
    public static class DataChangedNotifier
    {
        /// <summary>
        /// Returns the wire name of a domain type. The lower case full name is
        /// the one canonical derivation shared by the addressing, the message
        /// payload and the service islands, so all three agree on the same
        /// identifier.
        /// </summary>
        /// <param name="type">The domain type.</param>
        /// <returns>The wire name, or <c>null</c> when the type is absent.</returns>
        public static string DomainName(Type type)
        {
            return type?.FullName?.ToLower();
        }

        /// <summary>
        /// Announces a change of the specified item when it belongs to a
        /// domain. An item that does not implement <see cref="IDomain"/> is
        /// ignored, so callers can pass their entity unconditionally.
        /// </summary>
        /// <param name="item">The changed item.</param>
        /// <param name="operation">The kind of change.</param>
        /// <param name="itemId">The optional id of the changed item.</param>
        /// <param name="cancellationToken">
        /// A token that propagates notification of request cancellation.
        /// </param>
        /// <returns>A task that represents the asynchronous operation.</returns>
        public static Task NotifyAsync(object item, DataChangeOperation operation, string itemId = null, CancellationToken cancellationToken = default)
        {
            if (item is not IDomain)
            {
                return Task.CompletedTask;
            }

            return NotifyAsync(item.GetType(), operation, itemId, cancellationToken);
        }

        /// <summary>
        /// Announces a change of the specified domain, for callers that know
        /// the domain type but hold no changed instance, for example a bulk
        /// operation or a background import.
        /// </summary>
        /// <typeparam name="TDomain">The changed domain type.</typeparam>
        /// <param name="operation">The kind of change.</param>
        /// <param name="itemId">The optional id of the changed item.</param>
        /// <param name="cancellationToken">
        /// A token that propagates notification of request cancellation.
        /// </param>
        /// <returns>A task that represents the asynchronous operation.</returns>
        public static Task NotifyAsync<TDomain>(DataChangeOperation operation, string itemId = null, CancellationToken cancellationToken = default)
            where TDomain : IDomain
        {
            return NotifyAsync(typeof(TDomain), operation, itemId, cancellationToken);
        }

        /// <summary>
        /// Announces a change of the specified domain type to every session
        /// that subscribed it. A missing message queue manager (for example in
        /// a test host) and transport failures are swallowed, because a change
        /// notification must never fail the data operation it follows.
        /// </summary>
        /// <param name="domainType">The changed domain type.</param>
        /// <param name="operation">The kind of change.</param>
        /// <param name="itemId">The optional id of the changed item.</param>
        /// <param name="cancellationToken">
        /// A token that propagates notification of request cancellation.
        /// </param>
        /// <returns>A task that represents the asynchronous operation.</returns>
        public static async Task NotifyAsync(Type domainType, DataChangeOperation operation, string itemId = null, CancellationToken cancellationToken = default)
        {
            var domain = DomainName(domainType);
            if (domain == null)
            {
                return;
            }

            try
            {
                var messageQueueManager = WebEx.ComponentHub?
                    .GetComponentManager<MessageQueueManager>();
                if (messageQueueManager == null)
                {
                    return;
                }

                var message = new DataChangedMessage(domain, operation, itemId);
                var address = new AddressDomain(domain);

                await messageQueueManager.SendAsync(address, message, cancellationToken);
            }
            catch
            {
                // a transport failure must never fail the data operation
            }
        }
    }
}
