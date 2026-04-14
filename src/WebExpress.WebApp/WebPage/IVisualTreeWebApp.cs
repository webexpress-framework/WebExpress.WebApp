using System;
using System.Collections.Generic;
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
        /// Gets or sets the theme of the web application.
        /// </summary>
        IThemeContext Theme { get; }

        /// <summary>
        /// Gets header control.
        /// </summary>
        ControlWebAppHeader Header { get; }

        /// <summary>
        /// Gets the area for the toast messages control.
        /// </summary>
        ControlWebAppToastnotification Toast { get; }

        /// <summary>
        /// Gets the range for the path specification.
        /// </summary>
        ControlBreadcrumb Breadcrumb { get; }

        /// <summary>
        /// Gets the area for prologue.
        /// </summary>
        ControlWebAppPrologue Prologue { get; }

        /// <summary>
        /// Gets the sidebar control.
        /// </summary>
        IControlWebAppSidebar Sidebar { get; }


        /// <summary>
        /// Gets the content control.
        /// </summary>
        new IControlWebAppContent Content { get; }

        /// <summary>
        /// Gets the footer control.
        /// </summary>
        IControlWebAppFooter Footer { get; }

        /// <summary>
        /// Gets the control for displaying notification popups via API.
        /// </summary>
        ControlRestPopupNotification NotificationPopup { get; }

        /// <summary>
        /// Gets a delegate that returns the collection of domain names associated with 
        /// the current context.
        /// </summary>
        Func<IEnumerable<string>> Domains { get; }
    }
}
