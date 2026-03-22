using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Defines the contract for a REST-backed tile control.
    /// </summary>
    public interface IControlRestTile : IControl
    {
        /// <summary>
        /// Returns or sets the uri that determines the data.
        /// </summary>
        IUri RestUri { get; }

        /// <summary>
        /// Returns or sets the binding.
        /// </summary>
        IBinding Bind { get; }
    }
}