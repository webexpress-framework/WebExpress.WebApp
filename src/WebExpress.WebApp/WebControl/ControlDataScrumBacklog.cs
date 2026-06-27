using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using WebExpress.WebApp.WebData;
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
    public class ControlDataScrumBacklog : ControlPanel, IControlDataScrumBacklog, IDataIsland
    {
        /// <summary>
        /// Gets or sets the title displayed by the backlog control.
        /// </summary>
        public Func<IRenderControlContext, string> Title { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether item selection is enabled.
        /// </summary>
        public Func<IRenderControlContext, bool> Selectable { get; set; } = _ => true;

        /// <summary>
        /// Gets or sets a value indicating whether the control is read-only.
        /// </summary>
        public Func<IRenderControlContext, bool> Readonly { get; set; }

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
        /// Gets the data service descriptors of the control, emitted together as
        /// the data-wx-service island that the JavaScript engine consumes in
        /// preference to the legacy data-rest-uri fallback, which keeps the
        /// endpoint and parameter knowledge authored in C#. When empty, the
        /// control behaves exactly as before and the client uses its legacy
        /// descriptor. See WebExpress/docs/view-state-service.md.
        /// </summary>
        public IList<Func<IRenderControlContext, DataServiceDescriptor>> ServiceFactories { get; } = [];

        /// <summary>
        /// Gets or sets the single data service descriptor, as a convenience for
        /// the common control with exactly one service. Reading returns the
        /// first declared service, assigning replaces all declared services.
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
        /// Gets or sets the optional template reference, emitted as the
        /// data-wx-template attribute that the client Templates registry
        /// resolves into a registered view.
        /// </summary>
        public Func<IRenderControlContext, string> TemplateFactory { get; set; }

        /// <summary>
        /// Gets or sets the optional initial state, emitted as the data-wx-state island.
        /// </summary>
        public Func<IRenderControlContext, DataState> StateFactory { get; set; }

        /// <summary>
        /// Gets or sets the optional story-point estimation scale offered in the
        /// assign/estimate dialog, emitted as the comma separated
        /// data-estimation-scale attribute. When not set, the client falls back to
        /// a rounded Fibonacci sequence.
        /// </summary>
        public Func<IRenderControlContext, IEnumerable<int>> EstimationScale { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlDataScrumBacklog(string id = null)
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
            var title = Title?.Invoke(renderContext);
            var selectable = Selectable?.Invoke(renderContext) ?? true;
            var @readonly = Readonly?.Invoke(renderContext) ?? false;
            var scale = EstimationScale?.Invoke(renderContext);

            var html = new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-scrum-backlog", GetClasses(renderContext)),
                Style = GetStyles(renderContext)
            }
                .AddUserAttribute("data-title", I18N.Translate(renderContext, title))
                .AddUserAttribute("data-selectable", selectable ? null : "false")
                .AddUserAttribute("data-readonly", @readonly ? "true" : null)
                .AddUserAttribute("data-icon-active", IconActive?.Invoke(renderContext))
                .AddUserAttribute("data-icon-planned", IconPlanned?.Invoke(renderContext))
                .AddUserAttribute("data-icon-backlog", IconBacklog?.Invoke(renderContext))
                .AddUserAttribute("data-icon-move-to-backlog", IconMoveToBacklog?.Invoke(renderContext))
                .AddUserAttribute("data-icon-move-to-sprint", IconMoveToSprint?.Invoke(renderContext))
                .AddUserAttribute("data-icon-start-sprint", IconStartSprint?.Invoke(renderContext))
                .AddUserAttribute("data-icon-complete-sprint", IconCompleteSprint?.Invoke(renderContext))
                .AddUserAttribute("data-icon-edit-sprint", IconEditSprint?.Invoke(renderContext))
                .AddUserAttribute("data-icon-delete-sprint", IconDeleteSprint?.Invoke(renderContext))
                .AddUserAttribute("data-estimation-scale", scale != null && scale.Any() ? string.Join(",", scale) : null)
                .EmitDataIslands(this, renderContext);

            return html;
        }
    }
}
