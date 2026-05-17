using System;
using System.Threading;
using WebExpress.WebCore.WebComponent;
using WebExpress.WebCore.WebTask;

namespace WebExpress.WebApp.WebMessageQueue
{
    /// <summary>
    /// Bridges the global <see cref="ITaskManager"/> to the WebSocket-based
    /// <see cref="IMessageQueueManager"/>. Every task lifecycle event
    /// (start, progress change, message change, finish) is pushed live to
    /// all connected clients; on (re)connect, every still-active task is
    /// replayed so a freshly arriving client immediately sees the current
    /// state of every long-running operation.
    /// </summary>
    public sealed class ProgressTaskDispatcher
    {
        private readonly IMessageQueueManager _messageQueueManager;
        private readonly IComponentHub _componentHub;
        private ITaskManager _taskManager;
        private bool _subscribed;

        /// <summary>
        /// Initializes a new instance and subscribes to the task manager's
        /// changed event so live progress updates start flowing through the
        /// message queue.
        /// </summary>
        /// <param name="messageQueueManager">
        /// The message queue manager used to forward task updates.
        /// </param>
        /// <param name="componentHub">
        /// The component hub used to resolve <see cref="ITaskManager"/>.
        /// </param>
        public ProgressTaskDispatcher
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
        /// Sends the current state of every active task to the specified
        /// socket so a freshly connecting or reconnecting client picks up
        /// every long-running operation it would otherwise miss.
        /// </summary>
        /// <param name="socket">The connecting socket.</param>
        /// <param name="cancellationToken">
        /// A token that propagates notification of request cancellation.
        /// </param>
        public async System.Threading.Tasks.Task ReplayAsync(IMessageQueueSocket socket, CancellationToken cancellationToken = default)
        {
            ArgumentNullException.ThrowIfNull(socket);

            TryAttach();
            if (_taskManager == null)
            {
                return;
            }

            var applicationId = socket.ClientSession?.ApplicationContext?.ApplicationId;

            foreach (var task in _taskManager.Tasks)
            {
                var message = new ProgressTaskMessage(task, applicationId);

                try
                {
                    await socket.SendAsync(message, cancellationToken);
                }
                catch
                {
                    // single dead connection must not abort the replay
                }
            }
        }

        /// <summary>
        /// Subscribes to <see cref="ITaskManager.TaskChanged"/> if the
        /// manager is available. The hub may instantiate managers lazily,
        /// so the call is idempotent and retried on every entry point.
        /// </summary>
        private void TryAttach()
        {
            if (_subscribed)
            {
                return;
            }

            _taskManager = _componentHub?.TaskManager;
            if (_taskManager == null)
            {
                return;
            }

            _taskManager.TaskChanged += OnTaskChanged;
            _subscribed = true;
        }

        /// <summary>
        /// Forwards a task lifecycle event through the message queue. Tasks
        /// live in a global registry and are not application-scoped, so the
        /// update is broadcast to every connected session and filtered on
        /// the client side via the task id.
        /// </summary>
        private async void OnTaskChanged(object sender, TaskEventArgs args)
        {
            if (args?.Task == null)
            {
                return;
            }

            try
            {
                var address = new AddressApplication(null);
                var message = new ProgressTaskMessage(args.Task);
                await _messageQueueManager.SendAsync(address, message);
            }
            catch
            {
                // swallow - never let a transport error tear down the task
                // manager event pipeline
            }
        }
    }
}
