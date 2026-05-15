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

        /// <summary>
        /// Gets the uri associated with this instance.
        /// </summary>
        string Uri { get; }

        /// <summary>
        /// Gets the optional color class associated with this tab.
        /// </summary>
        string Color { get; }

        /// <summary>
        /// Gets the optional primary action identifier associated with this tab.
        /// </summary>
        string PrimaryAction { get; }

        /// <summary>
        /// Gets the optional primary action target associated with this tab.
        /// </summary>
        string PrimaryTarget { get; }

        /// <summary>
        /// Gets the optional binding payload used for template bindings.
        /// </summary>
        object Binding { get; }
    }
}
