using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents the content control for a web application.
    /// </summary>
    public interface IControlWebAppContent : IControl
    {
        /// <summary>
        /// Returns the toolbar.
        /// </summary>
        IControlWebAppToolbar Toolbar { get; }

        /// <summary>
        /// Returns the main panel.
        /// </summary>
        IControlWebAppMain MainPanel { get; }

        /// <summary>
        /// Returns the page properties.
        /// </summary>
        IControlWebAppProperty Property { get; }
    }
}
