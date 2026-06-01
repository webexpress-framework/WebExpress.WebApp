using System;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Defines the contract for a REST-backed dashboard control.
    /// </summary>
    public interface IControlRestDashboard : IControl, IControlRest
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
    }
}