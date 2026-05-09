using System;
using System.Collections.Generic;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Defines the contract for a REST-backed tab control.
    /// </summary>
    public interface IControlRestTab : IControl, IControlRest
    {
        /// <summary>
        /// Gets the binding.
        /// </summary>
        Func<IRenderControlContext, IBinding> Bind { get; }

        /// <summary>
        /// Gets the collection of templates associated with the tab.
        /// </summary>
        IEnumerable<IControlRestTabTemplate> Templates { get; }

        /// <summary>
        /// Adds one or more templates to the tab control.
        /// </summary>
        /// <param name="templates">The templates to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlRestTab Add(params IControlRestTabTemplate[] templates);

        /// <summary>
        /// Adds one or more templates to the tab control.
        /// </summary>
        /// <param name="templates">The templates to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlRestTab Add(IEnumerable<IControlRestTabTemplate> templates);

        /// <summary>
        /// Removes the specified template from the tab control.
        /// </summary>
        /// <param name="templates">The template to remove.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlRestTab Remove(IControlRestTabTemplate templates);
    }
}