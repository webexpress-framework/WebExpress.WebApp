using System.Collections.Generic;
using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Settings controls for a web app.
    /// </summary>
    public interface IControlWebAppHeaderSettings : IControl
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
        IControlWebAppHeaderSettings AddPreferences(params IControlDropdownItem[] items);

        /// <summary>
        /// Removes an item from the preferences area.
        /// </summary>
        /// <param name="item">The item to remove from the preferences area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppHeaderSettings RemovePreference(IControlDropdownItem item);

        /// <summary>
        /// Adds items to the primary area.
        /// </summary>
        /// <param name="items">The items to add to the primary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppHeaderSettings AddPrimary(params IControlDropdownItem[] items);

        /// <summary>
        /// Removes an item from the primary area.
        /// </summary>
        /// <param name="item">The item to remove from the primary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppHeaderSettings RemovePrimary(IControlDropdownItem item);

        /// <summary>
        /// Adds items to the secondary area.
        /// </summary>
        /// <param name="items">The items to add to the secondary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppHeaderSettings AddSecondary(params IControlDropdownItem[] items);

        /// <summary>
        /// Removes an item from the secondary area.
        /// </summary>
        /// <param name="item">The item to remove from the secondary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppHeaderSettings RemoveSecondary(IControlDropdownItem item);
    }
}
