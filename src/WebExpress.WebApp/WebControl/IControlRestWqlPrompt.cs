using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents a control for composing and editing WQL expressions with REST-based suggestions, 
    /// syntax validation, and history navigation.
    /// </summary>
    public interface IControlRestWqlPrompt : IControl
    {
        /// <summary>
        /// Returns the uri that determines the data.
        /// </summary>
        IUri RestUri { get; }
    }
}