using System;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Defines the contract for a REST-backed scrum backlog control.
    /// </summary>
    public interface IControlRestScrumBacklog : IControlRest
    {
        /// <summary>
        /// Gets the title displayed by the backlog control.
        /// </summary>
        Func<IRenderControlContext, string> Title { get; }

        /// <summary>
        /// Gets a value indicating whether item selection is enabled.
        /// </summary>
        Func<IRenderControlContext, bool> Selectable { get; }

        /// <summary>
        /// Gets the icon used for active sprints.
        /// </summary>
        Func<IRenderControlContext, string> IconActive { get; }

        /// <summary>
        /// Gets the icon used for planned sprints.
        /// </summary>
        Func<IRenderControlContext, string> IconPlanned { get; }

        /// <summary>
        /// Gets the icon used for the backlog section.
        /// </summary>
        Func<IRenderControlContext, string> IconBacklog { get; }

        /// <summary>
        /// Gets the icon used for moving items back to the backlog.
        /// </summary>
        Func<IRenderControlContext, string> IconMoveToBacklog { get; }

        /// <summary>
        /// Gets the icon used for moving items into a sprint.
        /// </summary>
        Func<IRenderControlContext, string> IconMoveToSprint { get; }

        /// <summary>
        /// Gets the icon used for starting a sprint.
        /// </summary>
        Func<IRenderControlContext, string> IconStartSprint { get; }

        /// <summary>
        /// Gets the icon used for completing a sprint.
        /// </summary>
        Func<IRenderControlContext, string> IconCompleteSprint { get; }

        /// <summary>
        /// Gets the icon used for editing a sprint.
        /// </summary>
        Func<IRenderControlContext, string> IconEditSprint { get; }

        /// <summary>
        /// Gets the icon used for deleting a sprint.
        /// </summary>
        Func<IRenderControlContext, string> IconDeleteSprint { get; }
    }
}
