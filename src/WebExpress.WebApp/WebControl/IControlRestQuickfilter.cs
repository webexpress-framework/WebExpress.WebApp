using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Defines the contract for a REST-backed quickfilter control.
    /// </summary>
    public interface IControlRestQuickfilter : IControl
    {
        /// <summary>
        /// Gets or sets the uri that determines the data.
        /// </summary>
        IUri RestUri { get; set; }
    }
}