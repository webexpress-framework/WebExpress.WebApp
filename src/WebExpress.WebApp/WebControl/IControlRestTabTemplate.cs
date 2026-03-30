using System.Collections.Generic;
using WebExpress.WebCore.WebPage;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Defines the contract for a REST-backed tab template control.
    /// </summary>
    public interface IControlRestTabTempate : IWebUIElement<IRenderControlContext, IVisualTreeControl>
    {
        /// <summary>
        /// Adds one or more items to the tab control.
        /// </summary>
        /// <param name="items">The items to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlRestTabTempate Add(params IControl[] items);

        /// <summary>
        /// Adds one or more items to the tab control.
        /// </summary>
        /// <param name="items">The items to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlRestTabTempate Add(IEnumerable<IControl> items);

        /// <summary>
        /// Removes the specified control from the tab.
        /// </summary>
        /// <param name="item">The control to remove.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlRestTabTempate Remove(IControl item);
    }
}