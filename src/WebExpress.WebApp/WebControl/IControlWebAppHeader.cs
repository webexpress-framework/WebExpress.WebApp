using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Header for a web app.
    /// </summary>
    public interface IControlWebAppHeader : IControl
    {
        /// <summary>
        /// Gets or sets the text color.
        /// </summary>
        new PropertyColorNavbar TextColor { get; }

        /// <summary>
        /// Gets or sets whether the arrangement is fixed.
        /// </summary>
        TypeFixed Fixed { get; }

        /// <summary>
        /// Gets or sets the fixed arrangement when the toolbar is at the top.
        /// </summary>
        TypeSticky Sticky { get; }

        /// <summary>
        /// Gets or sets the application navigator.
        /// </summary>
        public IControlWebAppHeaderAppNavigator AppNavigator { get; }

        /// <summary>
        /// Gets or setss the name of the application.
        /// </summary>
        public IControlWebAppHeaderAppTitle AppTitle { get; }

        /// <summary>
        /// Gets or sets the navigation of the application.
        /// </summary>
        public IControlWebAppHeaderAppNavigation AppNavigation { get; }

        /// <summary>
        /// Gets or sets the quick create.
        /// </summary>
        public IControlWebAppHeaderQuickCreate QuickCreate { get; }

        /// <summary>
        /// Gets or sets the navigation of the application helpers.
        /// </summary>
        public IControlWebAppHeaderHelp Help { get; }

        /// <summary>
        /// Gets or sets the navigation of the application helpers.
        /// </summary>
        public IControlWebAppHeaderNotification Notifications { get; }

        /// <summary>
        /// Gets or sets the navigation of the application settings.
        /// </summary>
        public IControlWebAppHeaderSettings Settings { get; }
    }
}
