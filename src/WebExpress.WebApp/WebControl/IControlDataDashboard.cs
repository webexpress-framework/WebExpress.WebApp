using System;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Defines the contract for a REST-backed dashboard control.
    /// </summary>
    public interface IControlDataDashboard : IControl, IControlData
    {
        /// <summary>
        /// Gets a value indicating whether the column headers can be renamed inline.
        /// </summary>
        Func<IRenderControlContext, bool> EditableColumn { get; }

        /// <summary>
        /// Gets a value indicating whether the columns can be reordered via drag and drop.
        /// </summary>
        Func<IRenderControlContext, bool> MovableColumn { get; }

        /// <summary>
        /// Gets a value indicating whether the columns can be deleted.
        /// </summary>
        Func<IRenderControlContext, bool> DeletableColumn { get; }

        /// <summary>
        /// Gets a value indicating whether the board offers the "…" menu to add a new column.
        /// </summary>
        Func<IRenderControlContext, bool> AddableColumn { get; }

        /// <summary>
        /// Gets a value indicating whether the board offers the "…" menu to add a new widget.
        /// </summary>
        Func<IRenderControlContext, bool> AddableWidget { get; }

        /// <summary>
        /// Gets a value indicating whether each widget offers a settings entry in its "…" menu.
        /// </summary>
        Func<IRenderControlContext, bool> ConfigurableWidget { get; }

        /// <summary>
        /// Gets a value indicating whether the board takes the height its host
        /// offers instead of growing with its longest column.
        /// </summary>
        Func<IRenderControlContext, bool> Fill { get; }
    }
}