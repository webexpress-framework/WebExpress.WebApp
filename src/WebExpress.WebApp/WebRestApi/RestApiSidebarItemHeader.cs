namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// A non-interactive section caption in the REST sidebar. It sets the header
    /// type for the author, so a section label reads as a single construction.
    /// </summary>
    public class RestApiSidebarItemHeader : RestApiSidebarItem
    {
        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        public RestApiSidebarItemHeader()
        {
            Type = "header";
        }

        /// <summary>
        /// Initializes a new instance of the class with a label.
        /// </summary>
        /// <param name="label">The section caption.</param>
        public RestApiSidebarItemHeader(string label)
            : this()
        {
            Label = label;
        }
    }
}
