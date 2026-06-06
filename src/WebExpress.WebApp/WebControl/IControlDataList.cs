using System;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Defines the contract for a REST-backed list control.
    /// </summary>
    public interface IControlDataList : IControl, IControlData
    {
        /// <summary>
        /// Gets the binding.
        /// </summary>
        Func<IRenderControlContext, IBinding> Bind { get; }
    }
}