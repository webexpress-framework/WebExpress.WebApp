using System.Collections.Generic;
using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents the main control panel for the web application.
    /// </summary>
    public interface IControlWebAppMain : IControl
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
        /// Gets the headline control.
        /// </summary>
        IControlWebAppHeadline Headline { get; }

        /// <summary>
        /// Adds items to the preferences area.
        /// </summary>
        /// <param name="items">The items to add to the preferences area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppMain AddPreferences(params IControl[] items);

        /// <summary>
        /// Removes an item from the preferences area.
        /// </summary>
        /// <param name="item">The item to remove from the preferences area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppMain RemovePreference(IControl item);

        /// <summary>
        /// Adds items to the primary area.
        /// </summary>
        /// <param name="items">The items to add to the primary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppMain AddPrimary(params IControl[] items);

        /// <summary>
        /// Removes an item from the primary area.
        /// </summary>
        /// <param name="item">The item to remove from the primary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppMain RemovePrimary(IControl item);

        /// <summary>
        /// Adds items to the secondary area.
        /// </summary>
        /// <param name="items">The items to add to the secondary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppMain AddSecondary(params IControl[] items);

        /// <summary>
        /// Removes an item from the secondary area.
        /// </summary>
        /// <param name="item">The item to remove from the secondary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppMain RemoveSecondary(IControl item);
    }
}
