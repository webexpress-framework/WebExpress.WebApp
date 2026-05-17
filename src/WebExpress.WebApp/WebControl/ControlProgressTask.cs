using System;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Progress bar for a task (WebTask). Receives live updates over the
    /// MessageQueue WebSocket (see
    /// <c>WebExpress.WebApp.WebMessageQueue.ProgressTaskDispatcher</c>);
    /// the legacy REST polling endpoint is no longer required and the
    /// related <c>data-uri</c>/<c>data-interval</c> attributes are not
    /// emitted.
    /// </summary>
    public class ControlProgressTask : Control
    {
        /// <summary>
        /// Gets or sets the unique identifier of the task to display.
        /// </summary>
        public Func<IRenderControlContext, string> TaskId { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether the control should
        /// remain hidden until the first progress signal for the task
        /// arrives.
        /// </summary>
        public Func<IRenderControlContext, bool> ShowOnStart { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether the control should
        /// hide itself once the task finishes.
        /// </summary>
        public Func<IRenderControlContext, bool> HideOnFinish { get; set; }

        /// <summary>
        /// Initializes a new instance.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlProgressTask(string id = null)
            : base(id ?? "4EBDFDFC-51DA-48FC-A4DA-0339D3D4808A")
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
            var showOnStart = ShowOnStart?.Invoke(renderContext) ?? false;
            var hideOnFinish = HideOnFinish?.Invoke(renderContext) ?? false;

            return new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-progress-task", GetClasses()),
                Style = GetStyles()
            }
                .AddUserAttribute("data-task", taskId)
                .AddUserAttribute("data-show-on-start", showOnStart ? "true" : null)
                .AddUserAttribute("data-hide-on-finish", hideOnFinish ? "true" : null);
        }
    }
}
