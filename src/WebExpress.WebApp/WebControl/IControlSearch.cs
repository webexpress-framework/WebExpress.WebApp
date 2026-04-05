using System.Collections.Generic;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents a combined search control that integrates a basic search 
    /// input and an advanced WQL prompt into a single, user-toggleable 
    /// component. The control listens for webexpress.webui.Event.CHANGE_FILTER_EVENT from the
    /// basic search and webexpress.webapp.Event.WQL_FILTER_EVENT from the WQL
    /// prompt, normalizes their payloads and re-emits a unified
    /// webexpress.webui.Event.CHANGE_FILTER_EVENT.
    /// </summary>
    public interface IControlSearch : IControl
    {
        /// <summary>
        /// Returns the uri that determines the data.
        /// </summary>
        IUri RestUri { get; }

        /// <summary>
        /// Returns the content of the control (e.g., save button).
        /// </summary>
        IEnumerable<IControl> Content { get; }

        /// <summary>
        /// Adds one or more controls to the search control.
        /// </summary>
        /// <param name="controls">The items to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlSearch Add(params IControl[] controls);

        /// <summary>
        /// Adds one or more controls to the search control.
        /// </summary>
        /// <param name="controls">The controls to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlSearch Add(IEnumerable<IControl> controls);

        /// <summary>
        /// Removes the specified control from the view control.
        /// </summary>
        /// <param name="control">The control to remove.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlSearch Remove(IControl control);
    }
}