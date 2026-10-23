using System;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Defines the contract for a REST-backed scrum team workload control, which
    /// shows the people working in the current sprint together with the story
    /// points assigned to each of them.
    /// </summary>
    public interface IControlDataScrumTeam : IControlData
    {
        /// <summary>
        /// Gets the maximum number of people shown inline before the remaining
        /// ones collapse into a <c>+N</c> overflow chip that opens the modal.
        /// </summary>
        Func<IRenderControlContext, int?> MaxVisible { get; }

        /// <summary>
        /// Gets the color of the story point badge on each avatar.
        /// </summary>
        Func<IRenderControlContext, PropertyColorBackground> ColorPoints { get; }

        /// <summary>
        /// Gets the accent color of the completed story points in the modal.
        /// </summary>
        Func<IRenderControlContext, PropertyColorBackground> ColorCompleted { get; }
    }
}
