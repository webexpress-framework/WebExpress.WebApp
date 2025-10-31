using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Header for a web app.
    /// </summary>
    public interface IControlWebAppHeader : IControl
    {
        /// <summary>
        /// Returns or sets the text color.
        /// </summary>
        new PropertyColorNavbar TextColor { get; }

        /// <summary>
        /// Returns or sets whether the arrangement is fixed.
        /// </summary>
        TypeFixed Fixed { get; }

        /// <summary>
        /// Returns or sets the fixed arrangement when the toolbar is at the top.
        /// </summary>
        TypeSticky Sticky { get; }

        /// <summary>
        /// Returns or sets the application navigator.
        /// </summary>
        public IControlWebAppHeaderAppNavigator AppNavigator { get; }

        /// <summary>
        /// Returns or setss the name of the application.
        /// </summary>
        public IControlWebAppHeaderAppTitle AppTitle { get; }

        /// <summary>
        /// Returns or sets the navigation of the application.
        /// </summary>
        public IControlWebAppHeaderAppNavigation AppNavigation { get; }

        /// <summary>
        /// Returns or sets the quick create.
        /// </summary>
        public IControlWebAppHeaderQuickCreate QuickCreate { get; }

        /// <summary>
        /// Returns or sets the navigation of the application helpers.
        /// </summary>
        public IControlWebAppHeaderHelp Help { get; }

        /// <summary>
        /// Returns or sets the navigation of the application helpers.
        /// </summary>
        public IControlWebAppHeaderNotification Notifications { get; }

        /// <summary>
        /// Returns or sets the navigation of the application settings.
        /// </summary>
        public IControlWebAppHeaderSettings Settings { get; }
    }
}
