using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Defines the contract for a REST-backed dashboard control.
    /// </summary>
    public interface IControlRestDashboard : IControl
    {
        /// <summary>
        /// Returns the uri that determines the data.
        /// </summary>
        IUri RestUri { get; }
    }
}