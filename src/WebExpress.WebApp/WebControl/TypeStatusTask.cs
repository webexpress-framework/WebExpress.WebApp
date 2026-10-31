namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// The status a <see cref="ControlStatusTask"/> condenses into a single
    /// colored dot. It reduces the lifecycle of a server side task (or an ad hoc
    /// state) to one at-a-glance signal, so a dense surface (a table row, a list
    /// item, a header) can carry a status without the footprint of a progress bar.
    /// </summary>
    public enum TypeStatusTask
    {
        /// <summary>
        /// No status is known; the dot is rendered dim.
        /// </summary>
        None,

        /// <summary>
        /// The task exists but has not started yet; the dot is gray.
        /// </summary>
        Pending,

        /// <summary>
        /// The task is running; the dot is blue and pulses.
        /// </summary>
        Running,

        /// <summary>
        /// The task raised a warning; the dot is yellow. Warning is not part of the
        /// task lifecycle broadcast by the server, so it is only reachable through
        /// a static <see cref="ControlStatusTask.Status"/>.
        /// </summary>
        Warning,

        /// <summary>
        /// The task failed or was canceled; the dot is red.
        /// </summary>
        Error,

        /// <summary>
        /// The task finished successfully; the dot is green.
        /// </summary>
        Done
    }

    /// <summary>
    /// Provides extension methods for the <see cref="TypeStatusTask"/> enum.
    /// </summary>
    public static class TypeStatusTaskExtensions
    {
        /// <summary>
        /// Converts the status to the lowercase token the client runtime expects in
        /// the <c>data-status</c> attribute. The token is stable and culture
        /// independent so the JavaScript control can match it regardless of the
        /// active language.
        /// </summary>
        /// <param name="status">The status.</param>
        /// <returns>The data attribute token corresponding to the status.</returns>
        public static string ToValue(this TypeStatusTask status)
        {
            return status switch
            {
                TypeStatusTask.Pending => "pending",
                TypeStatusTask.Running => "running",
                TypeStatusTask.Warning => "warning",
                TypeStatusTask.Error => "error",
                TypeStatusTask.Done => "done",
                _ => "none",
            };
        }

        /// <summary>
        /// Parses a client token back into a <see cref="TypeStatusTask"/>. Unknown
        /// or empty tokens fall back to <see cref="TypeStatusTask.None"/> so a
        /// malformed value never throws.
        /// </summary>
        /// <param name="value">The token, as produced by <see cref="ToValue"/>.</param>
        /// <returns>The parsed status.</returns>
        public static TypeStatusTask ToStatusTask(this string value)
        {
            return value?.Trim().ToLowerInvariant() switch
            {
                "pending" => TypeStatusTask.Pending,
                "running" => TypeStatusTask.Running,
                "warning" => TypeStatusTask.Warning,
                "error" => TypeStatusTask.Error,
                "done" => TypeStatusTask.Done,
                _ => TypeStatusTask.None,
            };
        }
    }
}
