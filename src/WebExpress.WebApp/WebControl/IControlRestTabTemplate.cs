using System;
using System.Collections.Generic;
using WebExpress.WebCore.WebIcon;
using WebExpress.WebCore.WebPage;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Defines the contract for a REST-backed tab template control.
    /// </summary>
    public interface IControlRestTabTemplate : IWebUIElement<IRenderControlContext, IVisualTreeControl>
    {
        /// <summary>
        /// Gets the optional declarative binding configuration for template content.
        /// </summary>
        Func<IRenderControlContext, IBinding> Bind { get; }

        /// <summary>
        /// Gets the icon CSS class for the template.
        /// </summary>
        Func<IRenderControlContext, IIcon> Icon { get; }

        /// <summary>
        /// Gets the display name of the template.
        /// </summary>
        Func<IRenderControlContext, string> Name { get; }

        /// <summary>
        /// Gets the description of the template.
        /// </summary>
        Func<IRenderControlContext, string> Description { get; }

        /// <summary>
        /// Adds one or more items to the tab control.
        /// </summary>
        /// <param name="items">The items to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlRestTabTemplate Add(params IControl[] items);

        /// <summary>
        /// Adds one or more items to the tab control.
        /// </summary>
        /// <param name="items">The items to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlRestTabTemplate Add(IEnumerable<IControl> items);

        /// <summary>
        /// Removes the specified control from the tab.
        /// </summary>
        /// <param name="item">The control to remove.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlRestTabTemplate Remove(IControl item);
    }
}
