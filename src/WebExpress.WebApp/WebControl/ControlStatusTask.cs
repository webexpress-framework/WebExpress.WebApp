using System;
using System.Collections.Generic;
using WebExpress.WebApp.WebData;
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
    /// <para>
    /// Configuring a "starter" service (a POST endpoint declared through the
    /// <c>.Service("starter", ...)</c> authoring surface) turns the dot into a task
    /// starter: the client posts to the endpoint, the server starts the task and
    /// answers with its id, and the dot then follows that id live. The starter is
    /// triggered by a click on the dot, or on load when <see cref="AutoStart"/> is
    /// set. With <see cref="Repeat"/> the dot restarts the task through the same
    /// endpoint once it finishes successfully, so a single dot can drive a
    /// recurring task without any further server round trip from the page. A cancel
    /// or an error stops the loop, so a failing task never restarts forever.
    /// </para>
    /// </remarks>
    public class ControlStatusTask : Control, IDataIsland
    {
        /// <summary>
        /// Gets or sets the unique identifier of the task to follow. When null the
        /// control shows the static <see cref="Status"/> instead of subscribing to
        /// task updates. A starter without a fixed task id adopts the id the start
        /// endpoint returns.
        /// </summary>
        public Func<IRenderControlContext, string> TaskId { get; set; }

        /// <summary>
        /// Gets or sets the status shown when the control is not (yet) driven by a
        /// task update. Defaults to <see cref="TypeStatusTask.None"/>.
        /// </summary>
        public Func<IRenderControlContext, TypeStatusTask> Status { get; set; }

        /// <summary>
        /// Gets or sets the caption of a static dot (one without a task), which also
        /// serves as the tooltip fallback of every dot. A task driven dot instead
        /// shows the live server message of the task update as its caption, so the
        /// caption follows the current step and stays empty until the first update
        /// arrives. When null a task driven dot falls back to the server message and
        /// otherwise to the translated status name for its tooltip.
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
        /// Gets or sets a value indicating whether the starter posts to the start
        /// endpoint on load instead of on a click. Without a starter service the
        /// value has no effect. Defaults to false, so a starter dot waits for the
        /// user to click it.
        /// </summary>
        public Func<IRenderControlContext, bool> AutoStart { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether the starter restarts the task
        /// through the start endpoint once it finishes successfully. A cancel or an
        /// error stops the loop, so a failing task is not restarted forever. Without
        /// a starter service the value has no effect.
        /// </summary>
        public Func<IRenderControlContext, bool> Repeat { get; set; }

        /// <summary>
        /// Gets the data service descriptors of the control, emitted as wx-service
        /// island elements. The status dot uses a single "starter" service, a POST
        /// endpoint that starts the task and answers with its id.
        /// </summary>
        public IList<Func<IRenderControlContext, DataServiceDescriptor>> ServiceFactories { get; } = [];

        /// <summary>
        /// Gets or sets the single data service descriptor, as a convenience for
        /// the common control with exactly one service. Reading returns the first
        /// declared service, assigning replaces all declared services.
        /// </summary>
        public Func<IRenderControlContext, DataServiceDescriptor> ServiceFactory
        {
            get => ServiceFactories.Count > 0 ? ServiceFactories[0] : null;
            set
            {
                ServiceFactories.Clear();

                if (value != null)
                {
                    ServiceFactories.Add(value);
                }
            }
        }

        /// <summary>
        /// Gets or sets the optional initial state, emitted as the wx-state island.
        /// The status dot has no client state to seed, so this stays null.
        /// </summary>
        public Func<IRenderControlContext, DataState> StateFactory { get; set; }

        /// <summary>
        /// Gets or sets the optional template reference, emitted as the
        /// data-wx-template attribute. The status dot renders itself, so this stays
        /// null.
        /// </summary>
        public Func<IRenderControlContext, string> TemplateFactory { get; set; }

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
            var autoStart = AutoStart?.Invoke(renderContext) ?? false;
            var repeat = Repeat?.Invoke(renderContext) ?? false;

            var html = new HtmlElementTextContentDiv()
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
                .AddUserAttribute("data-hide-on-finish", hideOnFinish ? "true" : null)
                .AddUserAttribute("data-auto-start", autoStart ? "true" : null)
                .AddUserAttribute("data-repeat", repeat ? "true" : null);

            // the starter service island is emitted last so the fluent AddUserAttribute
            // chain keeps the concrete element type; EmitDataIslands prepends the
            // hidden wx-service child the client consumes before it builds the dot
            html.EmitDataIslands(this, renderContext);

            return html;
        }
    }
}
