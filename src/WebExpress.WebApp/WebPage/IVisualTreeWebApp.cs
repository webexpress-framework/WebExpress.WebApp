using WebExpress.WebApp.WebControl;
using WebExpress.WebCore.WebTheme;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebPage
{
    /// <summary>
    /// Represents the visual tree of the web application.
    /// </summary>
    public interface IVisualTreeWebApp : IVisualTreeControl
    {
        /// <summary>
        /// Returns or sets the theme of the web application.
        /// </summary>
        IThemeContext Theme { get; }

        /// <summary>
        /// Returns header control.
        /// </summary>
        ControlWebAppHeader Header { get; }

        /// <summary>
        /// Returns the area for the toast messages control.
        /// </summary>
        ControlWebAppToastnotification Toast { get; }

        /// <summary>
        /// Returns the range for the path specification.
        /// </summary>
        ControlBreadcrumb Breadcrumb { get; }

        /// <summary>
        /// Returns the area for prologue.
        /// </summary>
        ControlWebAppPrologue Prologue { get; }

        /// <summary>
        /// Returns the sidebar control.
        /// </summary>
        IControlWebAppSidebar Sidebar { get; }


        /// <summary>
        /// Returns the content control.
        /// </summary>
        new IControlWebAppContent Content { get; }

        /// <summary>
        /// Returns the footer control.
        /// </summary>
        IControlWebAppFooter Footer { get; }

        /// <summary>
        /// Returns the control for displaying notification popups via API.
        /// </summary>
        ControlRestPopupNotification NotificationPopup { get; }
    }
}
