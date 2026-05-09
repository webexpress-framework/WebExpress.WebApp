using System;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents a REST-backed scrum backlog control.
    /// </summary>
    public class ControlRestScrumBacklog : ControlPanel, IControlRestScrumBacklog
    {
        /// <summary>
        /// Gets or sets the uri that determines the data.
        /// </summary>
        public Func<IRenderControlContext, IUri> RestUri { get; set; }

        /// <summary>
        /// Gets or sets the title displayed by the backlog control.
        /// </summary>
        public Func<IRenderControlContext, string> Title { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether item selection is enabled.
        /// </summary>
        public Func<IRenderControlContext, bool> Selectable { get; set; } = _ => true;

        /// <summary>
        /// Gets or sets the icon used for active sprints.
        /// </summary>
        public Func<IRenderControlContext, string> IconActive { get; set; }

        /// <summary>
        /// Gets or sets the icon used for planned sprints.
        /// </summary>
        public Func<IRenderControlContext, string> IconPlanned { get; set; }

        /// <summary>
        /// Gets or sets the icon used for the backlog section.
        /// </summary>
        public Func<IRenderControlContext, string> IconBacklog { get; set; }

        /// <summary>
        /// Gets or sets the icon used for moving items back to the backlog.
        /// </summary>
        public Func<IRenderControlContext, string> IconMoveToBacklog { get; set; }

        /// <summary>
        /// Gets or sets the icon used for moving items into a sprint.
        /// </summary>
        public Func<IRenderControlContext, string> IconMoveToSprint { get; set; }

        /// <summary>
        /// Gets or sets the icon used for starting a sprint.
        /// </summary>
        public Func<IRenderControlContext, string> IconStartSprint { get; set; }

        /// <summary>
        /// Gets or sets the icon used for completing a sprint.
        /// </summary>
        public Func<IRenderControlContext, string> IconCompleteSprint { get; set; }

        /// <summary>
        /// Gets or sets the icon used for editing a sprint.
        /// </summary>
        public Func<IRenderControlContext, string> IconEditSprint { get; set; }

        /// <summary>
        /// Gets or sets the icon used for deleting a sprint.
        /// </summary>
        public Func<IRenderControlContext, string> IconDeleteSprint { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlRestScrumBacklog(string id = null)
            : base(id ?? RandomId.Create())
        {
        }

        /// <summary>
        /// Converts the control to an HTML representation.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <param name="visualTree">The visual tree.</param>
        /// <returns>An HTML node representing the rendered control.</returns>
        public override IHtmlNode Render(IRenderControlContext renderContext, IVisualTreeControl visualTree)
        {
            var uri = RestUri?.Invoke(renderContext);
            var resultUri = uri?.BindParameters(renderContext.Request);
            var title = Title?.Invoke(renderContext);
            var selectable = Selectable?.Invoke(renderContext) ?? true;

            var html = new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-scrum-backlog", GetClasses()),
                Style = GetStyles()
            }
                .AddUserAttribute("data-rest-uri", resultUri?.ToString())
                .AddUserAttribute("data-title", I18N.Translate(renderContext, title))
                .AddUserAttribute("data-selectable", selectable ? null : "false")
                .AddUserAttribute("data-icon-active", IconActive?.Invoke(renderContext))
                .AddUserAttribute("data-icon-planned", IconPlanned?.Invoke(renderContext))
                .AddUserAttribute("data-icon-backlog", IconBacklog?.Invoke(renderContext))
                .AddUserAttribute("data-icon-move-to-backlog", IconMoveToBacklog?.Invoke(renderContext))
                .AddUserAttribute("data-icon-move-to-sprint", IconMoveToSprint?.Invoke(renderContext))
                .AddUserAttribute("data-icon-start-sprint", IconStartSprint?.Invoke(renderContext))
                .AddUserAttribute("data-icon-complete-sprint", IconCompleteSprint?.Invoke(renderContext))
                .AddUserAttribute("data-icon-edit-sprint", IconEditSprint?.Invoke(renderContext))
                .AddUserAttribute("data-icon-delete-sprint", IconDeleteSprint?.Invoke(renderContext));

            return html;
        }
    }
}
