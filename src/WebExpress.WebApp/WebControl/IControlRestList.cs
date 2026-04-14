using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Defines the contract for a REST-backed list control.
    /// </summary>
    public interface IControlRestList : IControl
    {
        /// <summary>
        /// Gets or sets the uri that determines the data.
        /// </summary>
        IUri RestUri { get; set; }

        /// <summary>
        /// Gets the binding.
        /// </summary>
        IBinding Bind { get; }
    }
}