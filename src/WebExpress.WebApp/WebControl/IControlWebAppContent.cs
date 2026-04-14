using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents the content control for a web application.
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
