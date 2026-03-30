using System.Collections.Generic;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Defines the contract for a REST-backed tab control.
    /// </summary>
    public interface IControlRestTab : IControl
    {
        /// <summary>
        /// Returns or sets the uri that determines the data.
        /// </summary>
        IUri RestUri { get; }

        /// <summary>
        /// Returns or sets the binding.
        /// </summary>
        IBinding Bind { get; }

        /// <summary>
        /// Returns the collection of templates associated with the tab.
        /// </summary>
        IEnumerable<IControlRestTabTempate> Tempates { get; }

        /// <summary>
        /// Adds one or more templates to the tab control.
        /// </summary>
        /// <param name="templates">The templates to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlRestTab Add(params IControlRestTabTempate[] templates);

        /// <summary>
        /// Adds one or more templates to the tab control.
        /// </summary>
        /// <param name="templates">The templates to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlRestTab Add(IEnumerable<IControlRestTabTempate> templates);

        /// <summary>
        /// Removes the specified template from the tab control.
        /// </summary>
        /// <param name="templates">The template to remove.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlRestTab Remove(IControlRestTabTempate templates);
    }
}