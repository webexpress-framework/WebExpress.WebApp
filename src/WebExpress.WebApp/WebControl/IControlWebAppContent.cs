using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Contract for the main content area of a WebApp page.
    /// </summary>
    public interface IControlWebAppContent : IControl
    {
        /// <summary>
        /// Gets the toolbar.
        /// </summary>
        IControlWebAppToolbar Toolbar { get; }

        /// <summary>
        /// Gets the main panel.
        /// </summary>
        IControlWebAppMain MainPanel { get; }

        /// <summary>
        /// Gets the page properties.
        /// </summary>
        IControlWebAppProperty Property { get; }
    }
}
