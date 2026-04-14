using System.Collections.Generic;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents a form that retrieves and displays data wizard from 
    /// a RESTful resource specified by a URI.
    /// </summary>
    public interface IControlRestWizard : IControlPanel
    {
        /// <summary>
        /// Gets the uri that determines the data.
        /// </summary>
        IUri RestUri { get; }

        /// <summary>
        /// Gets the mode that determines how the form behaves 
        /// or is rendered.
        /// </summary>
        TypeRestFormMode Mode { get; }

        /// <summary>
        /// Gets the collection of wizard pages associated with the control.
        /// </summary>
        IEnumerable<IControlRestWizardPage> Pages { get; }

        /// <summary>
        /// Adds one or more pages to the wizard control.
        /// </summary>
        /// <param name="pages">The pages to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlRestWizard Add(params IControlRestWizardPage[] pages);

        /// <summary>
        /// Adds one or more pages to the wizard control.
        /// </summary>
        /// <param name="pages">The pages to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlRestWizard Add(IEnumerable<IControlRestWizardPage> pages);

        /// <summary>
        /// Removes the specified page from the wizard control.
        /// </summary>
        /// <param name="page">The page to remove.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlRestWizard Remove(IControlRestWizardPage page);
    }
}