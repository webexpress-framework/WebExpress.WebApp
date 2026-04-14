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
        public string TaskId { get; set; }

        /// <summary>
        /// Gets or sets the interval, in milliseconds, for the operation or process.
        /// </summary>
        public int Interval { get; set; } = -1;

        /// <summary>
        /// Gets or sets a value indicating whether the application should display the 
        /// start screen when launched.
        /// </summary>
        public bool ShowOnStart { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether the associated element should be 
        /// hidden when the operation is
        /// complete.
        /// </summary>
        public bool HideOnFinish { get; set; }

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

            if (!Enable)
            {
                return null;
            }

            var html = new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-progress-task", GetClasses()),
                Style = GetStyles()
            }
                .AddUserAttribute("data-task", TaskId)
                .AddUserAttribute("data-interval", Interval > 0 ? Interval.ToString() : null)
                .AddUserAttribute("data-show-on-start", ShowOnStart ? "true" : null)
                .AddUserAttribute("data-hide-on-finish", HideOnFinish ? "true" : null)
                .AddUserAttribute("data-uri", WebEx.ComponentHub
                    .SitemapManager
                    .GetUri<ProgressTask>(applicationContext).ToString()
                );

            return html;
        }
    }
}
