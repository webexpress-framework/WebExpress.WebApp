using System.Collections.Generic;
using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents the header navigation control for the web application.
    /// </summary>
    public interface IControlWebAppHeaderAppNavigation : IControlPanel
    {
        /// <summary>
        /// Returns the preferences area.
        /// </summary>
        IEnumerable<IControlNavigationItem> Preferences { get; }

        /// <summary>
        /// Returns the primary area.
        /// </summary>
        IEnumerable<IControlNavigationItem> Primary { get; }

        /// <summary>
        /// Returns the secondary area.
        /// </summary>
        IEnumerable<IControlNavigationItem> Secondary { get; }

        /// <summary>
        /// Adds items to the preferences area.
        /// </summary>
        /// <param name="items">The items to add to the preferences area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppHeaderAppNavigation AddPreferences(params IControlNavigationItem[] items);

        /// <summary>
        /// Removes an item from the preferences area.
        /// </summary>
        /// <param name="item">The item to remove from the preferences area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppHeaderAppNavigation RemovePreference(IControlNavigationItem item);

        /// <summary>
        /// Adds items to the primary area.
        /// </summary>
        /// <param name="items">The items to add to the primary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppHeaderAppNavigation AddPrimary(params IControlNavigationItem[] items);

        /// <summary>
        /// Removes an item from the primary area.
        /// </summary>
        /// <param name="item">The item to remove from the primary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppHeaderAppNavigation RemovePrimary(IControlNavigationItem item);

        /// <summary>
        /// Adds items to the secondary area.
        /// </summary>
        /// <param name="items">The items to add to the secondary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppHeaderAppNavigation AddSecondary(params IControlNavigationItem[] items);

        /// <summary>
        /// Removes an item from the secondary area.
        /// </summary>
        /// <param name="item">The item to remove from the secondary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppHeaderAppNavigation RemoveSecondary(IControlNavigationItem item);
    }
}
