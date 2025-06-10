using System.Collections.Generic;
using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.WebControl
{
    public interface IControlRestTable : IControlRest
    {
        /// <summary>
        /// Returns the collection of forms associated with the control.
        /// </summary>
        public IEnumerable<IControlForm> Forms { get; }

        /// <summary>
        /// Returns the settings for the editing options (e.g. Edit, Delete, ...).
        /// </summary>
        IEnumerable<ControlRestTableOptionItem> OptionItems { get; }

        /// <summary>
        /// Adds a collection of forms to the current control rest table.
        /// </summary>
        /// <param name="forms">The collection of forms to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlRestTable Add(params IControlForm[] forms);

        /// <summary>
        /// Adds a collection of forms to the current control rest table.
        /// </summary>
        /// <param name="forms">The collection of forms to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlRestTable Add(IEnumerable<IControlForm> forms);

        /// <summary>
        /// Removes the specified form from the collection of forms.
        /// </summary>
        /// <param name="form">The form to remove.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlRestTable Remove(IControlForm form);
    }
}
