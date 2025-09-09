using System.Collections.Generic;
using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents a sidebar control for the web application.
    /// </summary>
    public interface IControlWebAppSidebar : IControl
    {
        /// <summary>
        /// Returns the header area.
        /// </summary>
        IEnumerable<IControl> Header { get; }

        /// <summary>
        /// Returns the preferences area.
        /// </summary>
        IEnumerable<IControl> Preferences { get; }

        /// <summary>
        /// Returns the primary area.
        /// </summary>
        IEnumerable<IControl> Primary { get; }

        /// <summary>
        /// Returns the secondary area.
        /// </summary>
        IEnumerable<IControl> Secondary { get; }

        /// <summary>
        /// Adds items to the header area.
        /// </summary>
        /// <param name="items">The items to add to the header area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppSidebar AddHeader(params IControl[] items);

        /// <summary>
        /// Removes an item from the header area.
        /// </summary>
        /// <param name="item">The item to remove from the header area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppSidebar RemoveHeader(IControl item);

        /// <summary>
        /// Adds items to the preferences area.
        /// </summary>
        /// <param name="items">The items to add to the preferences area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppSidebar AddPreferences(params IControl[] items);

        /// <summary>
        /// Removes an item from the preferences area.
        /// </summary>
        /// <param name="item">The item to remove from the preferences area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppSidebar RemovePreference(IControl item);

        /// <summary>
        /// Adds items to the primary area.
        /// </summary>
        /// <param name="items">The items to add to the primary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppSidebar AddPrimary(params IControl[] items);

        /// <summary>
        /// Removes an item from the primary area.
        /// </summary>
        /// <param name="item">The item to remove from the primary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppSidebar RemovePrimary(IControl item);

        /// <summary>
        /// Adds items to the secondary area.
        /// </summary>
        /// <param name="items">The items to add to the secondary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppSidebar AddSecondary(params IControl[] items);

        /// <summary>
        /// Removes an item from the secondary area.
        /// </summary>
        /// <param name="item">The item to remove from the secondary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppSidebar RemoveSecondary(IControl item);
    }
}
