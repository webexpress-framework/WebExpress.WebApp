using System;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Defines the contract for a REST-backed scrum velocity control, which shows
    /// the completed story points (the velocity) of the last few sprints as a
    /// bar chart with an average line.
    /// </summary>
    public interface IControlDataScrumVelocity : IControlData
    {
        /// <summary>
        /// Gets the maximum number of most recent sprints rendered in the chart.
        /// </summary>
        Func<IRenderControlContext, int?> MaxSprints { get; }

        /// <summary>
        /// Gets whether the chart offers a slider that narrows the plotted
        /// sprints to a window of the loaded history.
        /// </summary>
        Func<IRenderControlContext, bool> ShowSprintFilter { get; }

        /// <summary>
        /// Gets the color of the completed (velocity) bars.
        /// </summary>
        Func<IRenderControlContext, PropertyColorBackground> ColorCompleted { get; }

        /// <summary>
        /// Gets the color of the committed backdrop bars.
        /// </summary>
        Func<IRenderControlContext, PropertyColorBackground> ColorCommitted { get; }

        /// <summary>
        /// Gets the color of the average line.
        /// </summary>
        Func<IRenderControlContext, PropertyColorBackground> ColorAverage { get; }
    }
}
