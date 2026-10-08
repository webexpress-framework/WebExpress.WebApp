namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// A separator between groups of REST sidebar items. It sets the divider type
    /// for the author, so a separator reads as a single construction.
    /// </summary>
    public class RestApiSidebarItemDivider : RestApiSidebarItem
    {
        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        public RestApiSidebarItemDivider()
        {
            Type = "divider";
        }
    }
}
