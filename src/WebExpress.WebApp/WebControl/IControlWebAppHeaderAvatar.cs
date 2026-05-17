using System.Collections.Generic;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Avatar control for a web app header using a dropdown triggered by the avatar image.
    /// </summary>
    public interface IControlWebAppHeaderAvatar : IControl
    {
        /// <summary>
        /// Gets the user name associated with the current instance.
        /// </summary>
        public string Username { get; }

        /// <summary>
        /// Gets the icon image associated with this instance.
        /// </summary>
        public IUri Image { get; }

        /// <summary>
        /// Gets the preferences area.
        /// </summary>
        IEnumerable<IControlDropdownItem> Preferences { get; }

        /// <summary>
        /// Gets the primary area.
        /// </summary>
        IEnumerable<IControlDropdownItem> Primary { get; }

        /// <summary>
        /// Gets the secondary area.
        /// </summary>
        IEnumerable<IControlDropdownItem> Secondary { get; }

        /// <summary>
        /// Adds items to the preferences area.
        /// </summary>
        /// <param name="items">The items to add to the preferences area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppHeaderAvatar AddPreferences(params IControlDropdownItem[] items);

        /// <summary>
        /// Removes an item from the preferences area.
        /// </summary>
        /// <param name="item">The item to remove from the preferences area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppHeaderAvatar RemovePreference(IControlDropdownItem item);

        /// <summary>
        /// Adds items to the primary area.
        /// </summary>
        /// <param name="items">The items to add to the primary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppHeaderAvatar AddPrimary(params IControlDropdownItem[] items);

        /// <summary>
        /// Removes an item from the primary area.
        /// </summary>
        /// <param name="item">The item to remove from the primary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppHeaderAvatar RemovePrimary(IControlDropdownItem item);

        /// <summary>
        /// Adds items to the secondary area.
        /// </summary>
        /// <param name="items">The items to add to the secondary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppHeaderAvatar AddSecondary(params IControlDropdownItem[] items);

        /// <summary>
        /// Removes an item from the secondary area.
        /// </summary>
        /// <param name="item">The item to remove from the secondary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppHeaderAvatar RemoveSecondary(IControlDropdownItem item);
    }
}
