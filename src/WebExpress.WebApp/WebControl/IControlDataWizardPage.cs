using System;
using System.Collections.Generic;
using WebExpress.WebCore.WebPage;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Defines the contract for a REST-backed wizard page control.
    /// </summary>
    public interface IControlDataWizardPage : IWebUIElement<IRenderControlContext, IVisualTreeControl>
    {
        /// <summary>
        /// Gets the title of the step, shown in the progress indicator.
        /// </summary>
        Func<IRenderControlContext, string> Title { get; }

        /// <summary>
        /// Gets the secondary text of the step, shown below its title.
        /// </summary>
        Func<IRenderControlContext, string> Subtitle { get; }

        /// <summary>
        /// Gets the name of the input whose selected label replaces the subtitle once
        /// the step has been answered.
        /// </summary>
        Func<IRenderControlContext, string> SummarySource { get; }

        /// <summary>
        /// Gets the uri the step is loaded from, or null for a step rendered upfront.
        /// </summary>
        Func<IRenderControlContext, IUri> Uri { get; }

        /// <summary>
        /// Gets the form layout.
        /// </summary>
        Func<IRenderControlContext, TypeLayoutForm> FormLayout { get; }

        /// <summary>
        /// Gets the item layout.
        /// </summary>
        Func<IRenderControlContext, TypeLayoutFormItem> ItemLayout { get; }

        /// <summary>
        /// Gets the collection of form items contained in this control.
        /// </summary>
        IEnumerable<IControlFormItem> Items { get; }

        /// <summary>
        /// Adds one or more items to the wizard page control.
        /// </summary>
        /// <param name="items">The items to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlDataWizardPage Add(params IControlFormItem[] items);

        /// <summary>
        /// Adds one or more items to the wizard page control.
        /// </summary>
        /// <param name="items">The items to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlDataWizardPage Add(IEnumerable<IControlFormItem> items);

        /// <summary>
        /// Removes the specified control from wizard page tab.
        /// </summary>
        /// <param name="item">The control to remove.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlDataWizardPage Remove(IControlFormItem item);
    }
}