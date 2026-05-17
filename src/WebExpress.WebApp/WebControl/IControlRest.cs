using System;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Interface for controlling API interactions.
    /// </summary>
    public interface IControlRest : IControl
    {
        /// <summary>
        /// Gets the uri that determines the data.
        /// </summary>
        public Func<IRenderControlContext, IUri> RestUri { get; }
    }
}
