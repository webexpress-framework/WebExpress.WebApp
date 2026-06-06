using System;
using System.Collections.Generic;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Defines the contract for a REST-backed tab control.
    /// </summary>
    public interface IControlDataTab : IControl, IControlData
    {
        /// <summary>
        /// Gets the binding.
        /// </summary>
        Func<IRenderControlContext, IBinding> Bind { get; }

        /// <summary>
        /// Gets the collection of templates associated with the tab.
        /// </summary>
        IEnumerable<IControlDataTabTemplate> Templates { get; }

        /// <summary>
        /// Gets a value indicating whether the control is read-only.
        /// </summary>
        Func<IRenderControlContext, bool> Readonly { get; }

        /// <summary>
        /// Gets a value indicating whether the tabs can be reordered via drag
        /// and drop. When <see langword="true"/>, each tab header gets a ⠿ grip
        /// handle and the new order is persisted to the REST endpoint.
        /// </summary>
        Func<IRenderControlContext, bool> MovableTab { get; }

        /// <summary>
        /// Adds one or more templates to the tab control.
        /// </summary>
        /// <param name="templates">The templates to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlDataTab Add(params IControlDataTabTemplate[] templates);

        /// <summary>
        /// Adds one or more templates to the tab control.
        /// </summary>
        /// <param name="templates">The templates to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlDataTab Add(IEnumerable<IControlDataTabTemplate> templates);

        /// <summary>
        /// Removes the specified template from the tab control.
        /// </summary>
        /// <param name="templates">The template to remove.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlDataTab Remove(IControlDataTabTemplate templates);
    }
}
