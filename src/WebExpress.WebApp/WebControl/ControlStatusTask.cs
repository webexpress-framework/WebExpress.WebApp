using System;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Status dot for a task (WebTask). It condenses the same live task lifecycle
    /// the <see cref="ControlProgressTask"/> renders as a bar into a single colored
    /// point: red for an error, green for done, yellow for a warning, blue for a
    /// running task and gray for a pending one. Updates arrive over the MessageQueue
    /// WebSocket (see <c>WebExpress.WebApp.WebMessageQueue.ProgressTaskDispatcher</c>)
    /// - the same channel and the same <c>webexpress.webapp.progresstask.update</c>
    /// message the progress bar consumes - so the dot reflects the server state
    /// without any HTTP polling and survives navigation, reconnects and multiple
    /// windows.
    /// </summary>
    /// <remarks>
    /// Left without a <see cref="TaskId"/> the control renders the static
    /// <see cref="Status"/> instead of subscribing to task updates, which is the way
    /// to show a plain status point in a dense surface that is not backed by a
    /// running task.
    /// </remarks>
    public class ControlStatusTask : Control
    {
        /// <summary>
        /// Gets or sets the unique identifier of the task to follow. When null the
        /// control shows the static <see cref="Status"/> instead of subscribing to
        /// task updates.
        /// </summary>
        public Func<IRenderControlContext, string> TaskId { get; set; }

        /// <summary>
        /// Gets or sets the status shown when the control is not (yet) driven by a
        /// task update. Defaults to <see cref="TypeStatusTask.None"/>.
        /// </summary>
        public Func<IRenderControlContext, TypeStatusTask> Status { get; set; }

        /// <summary>
        /// Gets or sets the optional caption rendered next to the dot; it also
        /// serves as the tooltip. When null a task driven dot falls back to the
        /// server message and otherwise to the translated status name.
        /// </summary>
        public Func<IRenderControlContext, string> Label { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether the control stays hidden until
        /// the first update for the task arrives.
        /// </summary>
        public Func<IRenderControlContext, bool> ShowOnStart { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether the control hides itself once the
        /// task finishes or is canceled.
        /// </summary>
        public Func<IRenderControlContext, bool> HideOnFinish { get; set; }

        /// <summary>
        /// Initializes a new instance.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlStatusTask(string id = null)
            : base(id ?? RandomId.Create())
        {
        }

        /// <summary>
        /// Converts the control to an HTML representation.
        /// </summary>
        /// <param name="renderContext">The render context.</param>
        /// <param name="visualTree">The visual tree.</param>
        /// <returns>The rendered HTML node.</returns>
        public override IHtmlNode Render(IRenderControlContext renderContext, IVisualTreeControl visualTree)
        {
            var enable = Enable?.Invoke(renderContext) ?? true;
            if (!enable)
            {
                return null;
            }

            var taskId = TaskId?.Invoke(renderContext);
            var status = Status?.Invoke(renderContext) ?? TypeStatusTask.None;
            var label = Label?.Invoke(renderContext);
            var showOnStart = ShowOnStart?.Invoke(renderContext) ?? false;
            var hideOnFinish = HideOnFinish?.Invoke(renderContext) ?? false;

            return new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-status-task", GetClasses(renderContext)),
                Style = GetStyles(renderContext)
            }
                .AddUserAttribute("data-task", taskId)
                // the none default is implied; only a real status is seeded
                .AddUserAttribute("data-status", status != TypeStatusTask.None ? status.ToValue() : null)
                .AddUserAttribute("data-label", label)
                .AddUserAttribute("data-show-on-start", showOnStart ? "true" : null)
                .AddUserAttribute("data-hide-on-finish", hideOnFinish ? "true" : null);
        }
    }
}
