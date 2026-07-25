using System;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Defines the contract for a REST-backed workflow control.
    /// </summary>
    public interface IControlDataWorkflow : IControl, IControlData
    {
        /// <summary>
        /// Gets or sets the cell size of the designer's background grid, in canvas
        /// units. A value of 0 (the default) leaves the grid off; the grid is a
        /// layout aid, so it is shown only where it is asked for.
        /// </summary>
        Func<IRenderControlContext, int> Grid { get; set; }

        /// <summary>
        /// Gets or sets whether dragging a state or a waypoint snaps it to the grid.
        /// Has no effect while <see cref="Grid"/> is 0.
        /// </summary>
        Func<IRenderControlContext, bool> GridSnap { get; set; }
    }
}