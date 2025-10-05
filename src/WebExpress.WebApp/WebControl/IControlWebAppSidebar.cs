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
        IEnumerable<IControlSidebarItem> Header { get; }

        /// <summary>
        /// Returns the preferences area.
        /// </summary>
        IEnumerable<IControlSidebarItem> Preferences { get; }

        /// <summary>
        /// Returns the primary area.
        /// </summary>
        IEnumerable<IControlSidebarItem> Primary { get; }

        /// <summary>
        /// Returns the secondary area.
        /// </summary>
        IEnumerable<IControlSidebarItem> Secondary { get; }

        /// <summary>
        /// Returns the preferences area of the toolbar.
        /// </summary>
        IEnumerable<IControlToolbarItem> ToolPreferences { get; }

        /// <summary>
        /// Returns the primary area of the toolbar.
        /// </summary>
        IEnumerable<IControlToolbarItem> ToolPrimary { get; }

        /// <summary>
        /// Returns the secondary area of the toolbar.
        /// </summary>
        IEnumerable<IControlToolbarItem> ToolSecondary { get; }

        /// <summary>
        /// Adds items to the header area.
        /// </summary>
        /// <param name="items">The items to add to the header area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppSidebar AddHeader(params IControlSidebarItem[] items);

        /// <summary>
        /// Removes an item from the header area.
        /// </summary>
        /// <param name="item">The item to remove from the header area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppSidebar RemoveHeader(IControlSidebarItem item);

        /// <summary>
        /// Adds items to the preferences area.
        /// </summary>
        /// <param name="items">The items to add to the preferences area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppSidebar AddPreferences(params IControlSidebarItem[] items);

        /// <summary>
        /// Removes an item from the preferences area.
        /// </summary>
        /// <param name="item">The item to remove from the preferences area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppSidebar RemovePreference(IControlSidebarItem item);

        /// <summary>
        /// Adds items to the primary area.
        /// </summary>
        /// <param name="items">The items to add to the primary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppSidebar AddPrimary(params IControlSidebarItem[] items);

        /// <summary>
        /// Removes an item from the primary area.
        /// </summary>
        /// <param name="item">The item to remove from the primary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppSidebar RemovePrimary(IControlSidebarItem item);

        /// <summary>
        /// Adds items to the secondary area.
        /// </summary>
        /// <param name="items">The items to add to the secondary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppSidebar AddSecondary(params IControlSidebarItem[] items);

        /// <summary>
        /// Removes an item from the secondary area.
        /// </summary>
        /// <param name="item">The item to remove from the secondary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppSidebar RemoveSecondary(IControlSidebarItem item);

        /// <summary>
        /// Adds items to the preferences area of the toolbar.
        /// </summary>
        /// <param name="items">The items to add to the preferences area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppSidebar AddPreferences(params IControlToolbarItem[] items);

        /// <summary>
        /// Removes an item from the preferences area of the toolbar.
        /// </summary>
        /// <param name="item">The item to remove from the preferences area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppSidebar RemovePreference(IControlToolbarItem item);

        /// <summary>
        /// Adds items to the primary area.
        /// </summary>
        /// <param name="items">The items to add to the primary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppSidebar AddPrimary(params IControlToolbarItem[] items);

        /// <summary>
        /// Removes an item from the primary area of the toolbar.
        /// </summary>
        /// <param name="item">The item to remove from the primary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppSidebar RemovePrimary(IControlToolbarItem item);

        /// <summary>
        /// Adds items to the secondary area of the toolbar.
        /// </summary>
        /// <param name="items">The items to add to the secondary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppSidebar AddSecondary(params IControlToolbarItem[] items);

        /// <summary>
        /// Removes an item from the secondary area of the toolbar.
        /// </summary>
        /// <param name="item">The item to remove from the secondary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppSidebar RemoveSecondary(IControlToolbarItem item);
    }
}
