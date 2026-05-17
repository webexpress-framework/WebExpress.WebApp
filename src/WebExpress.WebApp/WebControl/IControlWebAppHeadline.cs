using System.Collections.Generic;
using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Headline for an web app.
    /// </summary>
    public interface IControlWebAppHeadline : IControl
    {
        /// <summary>
        /// Gets or set the title.
        /// </summary>
        string Title { get; set; }

        /// <summary>
        /// Gets the prologue area.
        /// </summary>
        IEnumerable<IControl> Prologue { get; }

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
        /// Gets the secondary area for the metadata.
        /// </summary>
        IEnumerable<IControl> Metadata { get; }

        /// <summary>
        /// Gets the more control.
        /// </summary>
        IControlWebAppHeadlineMore More { get; }

        /// <summary>
        /// Adds items to the prologue area.
        /// </summary>
        /// <param name="items">The items to add to the prologue area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppHeadline AddPrologue(params IControl[] items);

        /// <summary>
        /// Removes an item from the prologue area.
        /// </summary>
        /// <param name="item">The item to remove from the prologue area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppHeadline RemovePrologue(IControl item);

        /// <summary>
        /// Adds items to the preferences area.
        /// </summary>
        /// <param name="items">The items to add to the preferences area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppHeadline AddPreferences(params IControl[] items);

        /// <summary>
        /// Removes an item from the preferences area.
        /// </summary>
        /// <param name="item">The item to remove from the preferences area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppHeadline RemovePreference(IControl item);

        /// <summary>
        /// Adds items to the primary area.
        /// </summary>
        /// <param name="items">The items to add to the primary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppHeadline AddPrimary(params IControl[] items);

        /// <summary>
        /// Removes an item from the primary area.
        /// </summary>
        /// <param name="item">The item to remove from the primary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppHeadline RemovePrimary(IControl item);

        /// <summary>
        /// Adds items to the secondary area.
        /// </summary>
        /// <param name="items">The items to add to the secondary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppHeadline AddSecondary(params IControl[] items);

        /// <summary>
        /// Removes an item from the secondary area.
        /// </summary>
        /// <param name="item">The item to remove from the secondary area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppHeadline RemoveSecondary(IControl item);

        /// <summary>
        /// Adds items to the metadata area.
        /// </summary>
        /// <param name="items">The items to add to the metadata area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppHeadline AddMetadata(params IControl[] items);

        /// <summary>
        /// Removes an item from the metadata area.
        /// </summary>
        /// <param name="item">The item to remove from the metadata area.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppHeadline RemoveMetadata(IControl item);
    }
}
