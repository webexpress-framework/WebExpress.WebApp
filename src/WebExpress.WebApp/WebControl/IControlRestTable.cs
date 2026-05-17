using System;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents a control that provides table-like functionality for 
    /// REST-based user interfaces.
    /// </summary>
    public interface IControlRestTable : IControlRest
    {
        /// <summary>
        /// Gets the number of items to display on each page in a 
        /// paginated collection.
        /// </summary>
        Func<IRenderControlContext, uint> PageSize { get; }

        /// <summary>
        /// Gets the binding.
        /// </summary>
        Func<IRenderControlContext, IBinding> Bind { get; }
    }
}
