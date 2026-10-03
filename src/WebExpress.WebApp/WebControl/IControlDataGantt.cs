using System;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Defines the contract for a REST-backed interactive gantt chart control.
    /// </summary>
    public interface IControlDataGantt : IControl, IControlData
    {
        /// <summary>
        /// Gets the initial timeline scale: day, week or month.
        /// </summary>
        Func<IRenderControlContext, string> Scale { get; }

        /// <summary>
        /// Gets the scales offered in the toolbar, as a comma separated subset
        /// of day, week and month.
        /// </summary>
        Func<IRenderControlContext, string> Scales { get; }

        /// <summary>
        /// Gets the grid columns offered to the user, as a comma separated
        /// subset of name, start, end, duration, progress and resources.
        /// </summary>
        Func<IRenderControlContext, string> Columns { get; }

        /// <summary>
        /// Gets a value indicating whether the plan is read-only, which
        /// disables every mutating interaction while the timeline stays fully
        /// navigable.
        /// </summary>
        Func<IRenderControlContext, bool> ReadOnly { get; }

        /// <summary>
        /// Gets a value indicating whether the task grid pane starts collapsed,
        /// leaving the full width to the timeline.
        /// </summary>
        Func<IRenderControlContext, bool> GridCollapsed { get; }

        /// <summary>
        /// Gets a value indicating whether the chart takes the height its host
        /// offers instead of bringing one of its own.
        /// </summary>
        Func<IRenderControlContext, bool> Fill { get; }
    }
}
