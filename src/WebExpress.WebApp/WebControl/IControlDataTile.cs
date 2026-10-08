using System;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Defines the contract for a REST-backed tile control.
    /// </summary>
    public interface IControlDataTile : IControl, IControlData
    {
        /// <summary>
        /// Gets or sets the binding.
        /// </summary>
        Func<IRenderControlContext, IBinding> Bind { get; }

        /// <summary>
        /// Gets a value indicating whether the tiles take the height their host
        /// offers instead of growing with their number.
        /// </summary>
        Func<IRenderControlContext, bool> Fill { get; }
    }
}