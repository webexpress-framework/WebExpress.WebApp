using System.Collections.Generic;
using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents a toolbar control for a web application.
    /// </summary>
    public interface IControlWebAppToolbar : IControlToolbar
    {
        /// <summary>
        /// Gets the preferences area.
        /// </summary>
        IEnumerable<IControlToolbarItem> Preferences { get; }

        /// <summary>
        /// Gets the primary area.
        /// </summary>
        IEnumerable<IControlToolbarItem> Primary { get; }

        /// <summary>
        /// Gets the secondary area.
        /// </summary>
        IEnumerable<IControlToolbarItem> Secondary { get; }

        /// <summary>
        /// Gets the preferences area of the more menu.
        /// </summary>
        IEnumerable<IControlDropdownItem> MorePreferences { get; }

        /// <summary>
        /// Gets the primary area of the more menu.
        /// </summary>
        IEnumerable<IControlDropdownItem> MorePrimary { get; }

        /// <summary>
        /// Gets the secondary area of the more menu.
        /// </summary>
        IEnumerable<IControlDropdownItem> MoreSecondary { get; }

        /// <summary>
        /// Adds items to the preferences area.
        /// </summary>
        /// <param name="items">The items to add to the preferences area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppToolbar AddPreferences(params IControlToolbarItem[] items);

        /// <summary>
        /// Removes an item from the preferences area.
        /// </summary>
        /// <param name="item">The item to remove from the preferences area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppToolbar RemovePreference(IControlToolbarItem item);

        /// <summary>
        /// Adds items to the primary area.
        /// </summary>
        /// <param name="items">The items to add to the primary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppToolbar AddPrimary(params IControlToolbarItem[] items);

        /// <summary>
        /// Removes an item from the primary area.
        /// </summary>
        /// <param name="item">The item to remove from the primary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppToolbar RemovePrimary(IControlToolbarItem item);

        /// <summary>
        /// Adds items to the secondary area.
        /// </summary>
        /// <param name="items">The items to add to the secondary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppToolbar AddSecondary(params IControlToolbarItem[] items);

        /// <summary>
        /// Removes an item from the secondary area.
        /// </summary>
        /// <param name="item">The item to remove from the secondary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppToolbar RemoveSecondary(IControlToolbarItem item);

        /// <summary>
        /// Adds items to the preferences area of the more menu.
        /// </summary>
        /// <param name="items">The items to add to the preferences area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppToolbar AddPreferences(params IControlDropdownItem[] items);

        /// <summary>
        /// Removes an item from the preferences area of the more menu.
        /// </summary>
        /// <param name="item">The item to remove from the preferences area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppToolbar RemovePreference(IControlDropdownItem item);

        /// <summary>
        /// Adds items to the primary area of the more menu.
        /// </summary>
        /// <param name="items">The items to add to the primary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppToolbar AddPrimary(params IControlDropdownItem[] items);

        /// <summary>
        /// Removes an item from the primary area of the more menu.
        /// </summary>
        /// <param name="item">The item to remove from the primary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppToolbar RemovePrimary(IControlDropdownItem item);

        /// <summary>
        /// Adds items to the secondary area of the more menu.
        /// </summary>
        /// <param name="items">The items to add to the secondary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppToolbar AddSecondary(params IControlDropdownItem[] items);

        /// <summary>
        /// Removes an item from the secondary area of the more menu.
        /// </summary>
        /// <param name="item">The item to remove from the secondary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppToolbar RemoveSecondary(IControlDropdownItem item);
    }
}
