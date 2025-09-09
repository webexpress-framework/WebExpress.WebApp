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
        /// Returns the preferences area.
        /// </summary>
        IEnumerable<IControlToolbarItem> Preferences { get; }

        /// <summary>
        /// Returns the primary area.
        /// </summary>
        IEnumerable<IControlToolbarItem> Primary { get; }

        /// <summary>
        /// Returns the secondary area.
        /// </summary>
        IEnumerable<IControlToolbarItem> Secondary { get; }

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
    }
}
