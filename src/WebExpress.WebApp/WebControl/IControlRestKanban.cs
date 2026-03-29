using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Defines the contract for a REST-backed kanban control.
    /// </summary>
    public interface IControlRestKanban : IControl
    {
        /// <summary>
        /// Returns or sets the uri that determines the data.
        /// </summary>
        IUri RestUri { get; }
    }
}