using System;
using WebExpress.WebApp.WWW.Api.V1;
using WebExpress.WebCore;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebApiControl
{
    /// <summary>
    /// Task progress bar.
    /// </summary>
    public class ControlRestProgressTask : Control
    {
        /// <summary>
        /// Gets or sets the unique identifier for the task.
        /// </summary>
        public Func<IRenderControlContext, string> TaskId { get; set; }

        /// <summary>
        /// Gets or sets the interval, in milliseconds, for the operation or process.
        /// </summary>
        public Func<IRenderControlContext, int> Interval { get; set; } = _ => -1;

        /// <summary>
        /// Gets or sets a value indicating whether the application should display the 
        /// start screen when launched.
        /// </summary>
        public Func<IRenderControlContext, bool> ShowOnStart { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether the associated element should be 
        /// hidden when the operation is
        /// complete.
        /// </summary>
        public Func<IRenderControlContext, bool> HideOnFinish { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlRestProgressTask(string id = null)
            : base(id ?? "4EBDFDFC-51DA-48FC-A4DA-0339D3D4808A")
        {
        }

        /// <summary>
        /// Converts the control to an HTML representation.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <param name="visualTree">The visual tree representing the control's structure.</param>
        /// <returns>An HTML node representing the rendered control.</returns>
        public override IHtmlNode Render(IRenderControlContext renderContext, IVisualTreeControl visualTree)
        {
            var applicationContext = renderContext?.PageContext?.ApplicationContext;
            var enable = Enable?.Invoke(renderContext) ?? true;
            var taskId = TaskId?.Invoke(renderContext);
            var interval = Interval?.Invoke(renderContext) ?? -1;
            var showOnStart = ShowOnStart?.Invoke(renderContext) ?? false;
            var hideOnFinish = HideOnFinish?.Invoke(renderContext) ?? false;

            if (!enable)
            {
                return null;
            }

            var html = new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-progress-task", GetClasses()),
                Style = GetStyles()
            }
                .AddUserAttribute("data-task", taskId)
                .AddUserAttribute("data-interval", interval > 0 ? interval.ToString() : null)
                .AddUserAttribute("data-show-on-start", showOnStart ? "true" : null)
                .AddUserAttribute("data-hide-on-finish", hideOnFinish ? "true" : null)
                .AddUserAttribute("data-uri", WebEx.ComponentHub
                    .SitemapManager
                    .GetUri<ProgressTask>(applicationContext).ToString()
                );

            return html;
        }
    }
}
