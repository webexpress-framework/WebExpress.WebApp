using System;
using System.Collections.Generic;
using WebExpress.WebCore.WebTask;

namespace WebExpress.WebApp.WebMessageQueue
{
    /// <summary>
    /// Wire-format envelope used to deliver a progress task update from the
    /// server to all connected clients. The client side
    /// <c>ProgressTaskCtrl</c> filters by <see cref="TaskId"/> and ignores
    /// updates for tasks it does not display.
    /// </summary>
    public sealed class ProgressTaskMessage : IMessage
    {
        /// <summary>
        /// Gets the application-defined message type. Always
        /// <see cref="ProgressTaskMessageTypes.Update"/> for this class.
        /// </summary>
        public string Type { get; }

        /// <summary>
        /// Gets the unique message identifier.
        /// </summary>
        public string MessageId { get; }

        /// <summary>
        /// Gets the application id, if known.
        /// </summary>
        public string ApplicationId { get; }

        /// <summary>
        /// Gets the socket endpoint identifier (unused for progress tasks).
        /// </summary>
        public string SocketId { get; }

        /// <summary>
        /// Gets the connection id (unused for progress tasks).
        /// </summary>
        public string ConnectionId { get; }

        /// <summary>
        /// Gets the optional sender identifier.
        /// </summary>
        public string Sender { get; }

        /// <summary>
        /// Gets the UTC creation timestamp of this envelope.
        /// </summary>
        public DateTime Timestamp { get; }

        /// <summary>
        /// Gets the (empty) metadata dictionary required by
        /// <see cref="IMessage"/>.
        /// </summary>
        public IDictionary<string, string> Meta { get; }

        /// <summary>
        /// Gets the unique id of the task this update refers to.
        /// </summary>
        public string TaskId { get; }

        /// <summary>
        /// Gets the numeric task state (<see cref="TaskState"/>).
        /// </summary>
        public int State { get; }

        /// <summary>
        /// Gets the progress as a percentage from 0 to 100.
        /// </summary>
        public int Progress { get; }

        /// <summary>
        /// Gets the current status message, if any.
        /// </summary>
        public string Message { get; }

        /// <summary>
        /// Initializes a new instance from the specified task snapshot.
        /// </summary>
        /// <param name="task">The task whose state is being broadcast.</param>
        /// <param name="applicationId">
        /// The owning application id, if known.
        /// </param>
        public ProgressTaskMessage(ITask task, string applicationId = null)
        {
            ArgumentNullException.ThrowIfNull(task);

            Type = ProgressTaskMessageTypes.Update;
            MessageId = Guid.NewGuid().ToString("N");
            ApplicationId = applicationId;
            Timestamp = DateTime.UtcNow;
            Meta = new Dictionary<string, string>();

            TaskId = task.Id;
            State = (int)task.State;
            Progress = task.Progress;
            Message = task.Message;
        }
    }
}
