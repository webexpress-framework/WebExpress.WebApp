using System;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Defines the contract for a REST-backed tile control.
    /// </summary>
    public interface IControlRestTile : IControl, IControlRest
    {
        /// <summary>
        /// Gets or sets the binding.
        /// </summary>
        Func<IRenderControlContext, IBinding> Bind { get; }
    }
}