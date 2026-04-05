using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Interface for controlling API interactions.
    /// </summary>
    public interface IControlRest : IControl
    {
        /// <summary>
        /// Returns the uri that determines the data.
        /// </summary>
        public IUri RestUri { get; }
    }
}
