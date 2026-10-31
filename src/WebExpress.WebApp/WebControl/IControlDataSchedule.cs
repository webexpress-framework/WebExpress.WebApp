using System;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Defines the contract for a REST-backed schedule.
    /// </summary>
    public interface IControlDataSchedule : IControlSchedule, IControlData
    {
        /// <summary>
        /// Gets a value indicating whether the schedule loads its items on the
        /// first paint.
        /// </summary>
        Func<IRenderControlContext, bool> AutoLoad { get; }

        /// <summary>
        /// Gets a value indicating whether stepping to another period or
        /// switching the view reloads the items of the new range.
        /// </summary>
        Func<IRenderControlContext, bool> ReloadOnNavigate { get; }

        /// <summary>
        /// Gets the interval, in seconds, at which the shown period is reloaded.
        /// </summary>
        Func<IRenderControlContext, int?> RefreshInterval { get; }

        /// <summary>
        /// Gets a value indicating whether a range that has already been loaded
        /// is served from the client cache.
        /// </summary>
        Func<IRenderControlContext, bool> Cache { get; }

        /// <summary>
        /// Gets the region the holidays are requested for.
        /// </summary>
        Func<IRenderControlContext, string> HolidayRegion { get; }

        /// <summary>
        /// Gets a value indicating whether new items may be created.
        /// </summary>
        Func<IRenderControlContext, bool> Creatable { get; }

        /// <summary>
        /// Gets a value indicating whether items may be deleted.
        /// </summary>
        Func<IRenderControlContext, bool> Deletable { get; }
    }
}
