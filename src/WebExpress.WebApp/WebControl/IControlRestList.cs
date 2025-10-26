using System.Collections.Generic;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Defines the contract for a REST-backed list control.
    /// </summary>
    public interface IControlRestList : IControl
    {
        /// <summary>
        /// Gets or sets the uri that determines the data.
        /// </summary>
        IUri RestUri { get; set; }

        /// <summary>
        /// Returns the collection of forms associated with the control.
        /// </summary>
        IEnumerable<IControlForm> Forms { get; }

        /// <summary>
        /// Returns the editing options (e.g., Edit, Delete, ...).
        /// </summary>
        IEnumerable<ControlRestListOptionItem> OptionItems { get; }

        /// <summary>
        /// Adds a set of forms to the current control rest list.
        /// </summary>
        /// <param name="forms">The forms to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlRestList Add(params IControlForm[] forms);

        /// <summary>
        /// Adds a collection of forms to the current control rest list.
        /// </summary>
        /// <param name="forms">The forms to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlRestList Add(IEnumerable<IControlForm> forms);

        /// <summary>
        /// Removes the specified form from the collection of forms.
        /// </summary>
        /// <param name="form">The form to remove.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlRestList Remove(IControlForm form);
    }
}