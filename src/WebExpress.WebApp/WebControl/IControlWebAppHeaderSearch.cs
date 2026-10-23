using System.Collections.Generic;
using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Contract for the search control in the WebApp header.
    /// </summary>
    public interface IControlWebAppHeaderSearch : IControl
    {
        /// <summary>
        /// Gets the search boxes contributed directly to the control.
        /// </summary>
        IEnumerable<ControlSearch> Searches { get; }

        /// <summary>
        /// Adds search boxes to the control.
        /// </summary>
        /// <param name="items">The search boxes to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppHeaderSearch Add(params ControlSearch[] items);

        /// <summary>
        /// Removes a search box from the control.
        /// </summary>
        /// <param name="item">The search box to remove.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlWebAppHeaderSearch Remove(ControlSearch item);
    }
}
