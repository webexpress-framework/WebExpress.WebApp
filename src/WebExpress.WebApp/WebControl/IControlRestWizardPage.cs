using System.Collections.Generic;
using WebExpress.WebCore.WebPage;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Defines the contract for a REST-backed wizard page control.
    /// </summary>
    public interface IControlRestWizardPage : IWebUIElement<IRenderControlContext, IVisualTreeControl>
    {
        /// <summary>
        /// Returns the form layout.
        /// </summary>
        TypeLayoutForm FormLayout { get; }

        /// <summary>
        /// Returns the item layout.
        /// </summary>
        TypeLayoutFormItem ItemLayout { get; }


        /// <summary>
        /// Returns the collection of form items contained in this control.
        /// </summary>
        IEnumerable<IControlFormItem> Items { get; }

        /// <summary>
        /// Adds one or more items to the wizard page control.
        /// </summary>
        /// <param name="items">The items to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlRestWizardPage Add(params IControlFormItem[] items);

        /// <summary>
        /// Adds one or more items to the wizard page control.
        /// </summary>
        /// <param name="items">The items to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlRestWizardPage Add(IEnumerable<IControlFormItem> items);

        /// <summary>
        /// Removes the specified control from wizard page tab.
        /// </summary>
        /// <param name="item">The control to remove.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlRestWizardPage Remove(IControlFormItem item);
    }
}