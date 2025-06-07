using WebExpress.WebCore.WebUri;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Interface for controlling API interactions.
    /// </summary>
    public interface IControlRest
    {
        /// <summary>
        /// Returns or sets the uri that determines the data.
        /// </summary>
        public IUri RestUri { get; set; }
    }
}
