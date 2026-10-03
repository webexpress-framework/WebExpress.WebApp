using System;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Defines the contract for a REST-backed kanban control.
    /// </summary>
    public interface IControlDataKanban : IControl, IControlData
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
        /// Gets a value indicating whether the board offers the "…" menu to add a new swimlane.
        /// </summary>
        Func<IRenderControlContext, bool> AddableSwimlane { get; }

        /// <summary>
        /// Gets a value indicating whether a swimlane can be renamed through its "…" menu.
        /// </summary>
        Func<IRenderControlContext, bool> EditableSwimlane { get; }

        /// <summary>
        /// Gets a value indicating whether a swimlane can be deleted through its "…" menu.
        /// </summary>
        Func<IRenderControlContext, bool> DeletableSwimlane { get; }

        /// <summary>
        /// Gets a value indicating whether a swimlane can be reordered (moved up or
        /// down) through its "…" menu.
        /// </summary>
        Func<IRenderControlContext, bool> MovableSwimlane { get; }

        /// <summary>
        /// Gets a value indicating whether the board offers the "…" menu entry that
        /// opens the settings dialog carrying the WQL filter.
        /// </summary>
        Func<IRenderControlContext, bool> ConfigurableBoard { get; }

        /// <summary>
        /// Gets a value indicating whether a swimlane offers the "…" menu entry that
        /// opens the settings dialog carrying the swimlane WQL filter.
        /// </summary>
        Func<IRenderControlContext, bool> ConfigurableSwimlane { get; }

        /// <summary>
        /// Gets a value indicating whether the board takes the height its host offers
        /// instead of growing with its longest column.
        /// </summary>
        Func<IRenderControlContext, bool> Fill { get; }
    }
}
