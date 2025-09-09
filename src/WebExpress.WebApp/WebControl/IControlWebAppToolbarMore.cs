using System.Collections.Generic;
using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents a toolbar control with more options in the web application.
    /// </summary>
    public interface IControlWebAppToolbarMore : IControl
    {
        /// <summary>
        /// Returns the preferences area.
        /// </summary>
        IEnumerable<IControlDropdownItem> Preferences { get; }

        /// <summary>
        /// Returns the primary area.
        /// </summary>
        IEnumerable<IControlDropdownItem> Primary { get; }

        /// <summary>
        /// Returns the secondary area.
        /// </summary>
        IEnumerable<IControlDropdownItem> Secondary { get; }

        /// <summary>
        /// Adds items to the preferences area.
        /// </summary>
        /// <param name="items">The items to add to the preferences area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppToolbarMore AddPreferences(params IControlDropdownItem[] items);

        /// <summary>
        /// Removes an item from the preferences area.
        /// </summary>
        /// <param name="item">The item to remove from the preferences area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppToolbarMore RemovePreference(IControlDropdownItem item);

        /// <summary>
        /// Adds items to the primary area.
        /// </summary>
        /// <param name="items">The items to add to the primary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppToolbarMore AddPrimary(params IControlDropdownItem[] items);

        /// <summary>
        /// Removes an item from the primary area.
        /// </summary>
        /// <param name="item">The item to remove from the primary area.</param>
        IControlWebAppToolbarMore RemovePrimary(IControlDropdownItem item);

        /// <summary>
        /// Adds items to the secondary area.
        /// </summary>
        /// <param name="items">The items to add to the secondary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppToolbarMore AddSecondary(params IControlDropdownItem[] items);

        /// <summary>
        /// Removes an item from the secondary area.
        /// </summary>
        /// <param name="item">The item to remove from the secondary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppToolbarMore RemoveSecondary(IControlDropdownItem item);
    }
}
