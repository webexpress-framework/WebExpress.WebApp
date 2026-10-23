using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using WebExpress.WebCore.WebCluster;
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
    /// state of every long-running operation. A task runs on the instance
    /// that started it; in a cluster its last state is also kept in the
    /// shared store, so a client connected to another instance sees it on
    /// (re)connect too.
    /// </summary>
    public sealed class ProgressTaskDispatcher
    {
        /// <summary>
        /// The scope task states are kept under in the cluster store.
        /// </summary>
        internal const string StoreScope = "task";

        // a task nobody reported on for an hour is either finished long ago or dead with its instance
        private static readonly TimeSpan SnapshotLifetime = TimeSpan.FromHours(1);

        /// <summary>
        /// The state of a task as recorded for the other instances.
        /// </summary>
        /// <param name="TaskId">The task id.</param>
        /// <param name="State">The numeric task state.</param>
        /// <param name="Progress">The progress as a percentage.</param>
        /// <param name="Message">The status message.</param>
        private sealed record Snapshot(string TaskId, int State, int Progress, string Message);

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

            var messages = _taskManager.Tasks.Select(x => new ProgressTaskMessage(x, applicationId)).ToList();
            var local = messages.Select(x => x.TaskId).ToHashSet(StringComparer.Ordinal);

            messages.AddRange(ReadShared()
                .Where(x => !local.Contains(x.TaskId))
                .Select(x => new ProgressTaskMessage(x.TaskId, x.State, x.Progress, x.Message, applicationId)));

            foreach (var message in messages)
            {

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
                Record(args.Task);

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

        /// <summary>
        /// Returns the cluster store while instances share one.
        /// </summary>
        private IClusterStore SharedStore => _componentHub?.ClusterManager?.Store is { IsShared: true } store ? store : null;

        /// <summary>
        /// Records the state of a task for clients that connect to another instance.
        /// </summary>
        /// <param name="task">The task.</param>
        private void Record(ITask task)
        {
            if (SharedStore is not { } store || string.IsNullOrEmpty(task.Id))
            {
                return;
            }

            var snapshot = new Snapshot(task.Id, (int)task.State, task.Progress, task.Message);

            store.Set(StoreScope, task.Id, JsonSerializer.SerializeToUtf8Bytes(snapshot), SnapshotLifetime);
        }

        /// <summary>
        /// Reads the task states every instance recorded.
        /// </summary>
        /// <returns>The recorded states.</returns>
        private IEnumerable<Snapshot> ReadShared()
        {
            if (SharedStore is not { } store)
            {
                return [];
            }

            var result = new List<Snapshot>();

            foreach (var item in store.List(StoreScope))
            {
                try
                {
                    if (JsonSerializer.Deserialize<Snapshot>(item.Value) is { TaskId: not null } snapshot)
                    {
                        result.Add(snapshot);
                    }
                }
                catch (JsonException)
                {
                    // an unreadable record costs one task its replay, not the whole replay
                }
            }

            return result;
        }
    }
}
