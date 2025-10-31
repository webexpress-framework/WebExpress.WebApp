using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// App title for a web app.
    /// </summary>
    public interface IControlWebAppHeaderAppTitle : IControlLink
    {
        /// <summary>
        /// Sets the title of the web application header.
        /// </summary>
        /// <param name="title">
        /// The title to display in the web application header. Cannot be null or empty.
        /// </param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppHeaderAppTitle SetTitle(string title);
    }
}
