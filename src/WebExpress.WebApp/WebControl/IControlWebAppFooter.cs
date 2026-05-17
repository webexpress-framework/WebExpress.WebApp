using System.Collections.Generic;
using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Footer for a web app.
    /// </summary>
    public interface IControlWebAppFooter : IControl
    {
        /// <summary>
        /// Gets the preferences area.
        /// </summary>
        IEnumerable<IControl> Preferences { get; }

        /// <summary>
        /// Gets the primary area.
        /// </summary>
        IEnumerable<IControl> Primary { get; }

        /// <summary>
        /// Gets the secondary area.
        /// </summary>
        IEnumerable<IControl> Secondary { get; }

        /// <summary>
        /// Adds items to the preferences area.
        /// </summary>
        /// <param name="items">The items to add to the preferences area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppFooter AddPreferences(params IControl[] items);

        /// <summary>
        /// Removes an item from the preferences area.
        /// </summary>
        /// <param name="item">The item to remove from the preferences area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppFooter RemovePreference(IControl item);

        /// <summary>
        /// Adds items to the primary area.
        /// </summary>
        /// <param name="items">The items to add to the primary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppFooter AddPrimary(params IControl[] items);

        /// <summary>
        /// Removes an item from the primary area.
        /// </summary>
        /// <param name="item">The item to remove from the primary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppFooter RemovePrimary(IControl item);

        /// <summary>
        /// Adds items to the secondary area.
        /// </summary>
        /// <param name="items">The items to add to the secondary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppFooter AddSecondary(params IControl[] items);

        /// <summary>
        /// Removes an item from the secondary area.
        /// </summary>
        /// <param name="item">The item to remove from the secondary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppFooter RemoveSecondary(IControl item);
    }
}
