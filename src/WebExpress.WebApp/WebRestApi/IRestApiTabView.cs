namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a tab view configuration for a REST API, including display 
    /// and identification properties.
    /// </summary>
    public interface IRestApiTabView
    {
        /// <summary>
        /// Gets the unique identifier for the tab view.
        /// </summary>
        string Id { get; }

        /// <summary>
        /// Gets the display label associated with the object.
        /// </summary>
        string Title { get; }

        /// <summary>
        /// Gets the name associated with the object.
        /// </summary>
        string Name { get; }

        /// <summary>
        /// Gets  the name or path of the icon associated with this instance.
        /// </summary>
        string Icon { get; }

        /// <summary>
        /// Gets the identifier of the template associated with this instance.
        /// </summary>
        string TemplateId { get; }
    }
}
