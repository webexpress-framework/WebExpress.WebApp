using System;
using System.Collections.Generic;
using WebExpress.WebCore.WebIcon;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents a form that retrieves and displays data wizard from 
    /// a RESTful resource specified by a URI.
    /// </summary>
    public interface IControlDataWizard : IControlPanel, IControlData
    {
        /// <summary>
        /// Gets the mode that determines how the form behaves 
        /// or is rendered.
        /// </summary>
        Func<IRenderControlContext, TypeRestFormMode> Mode { get; }

        /// <summary>
        /// Gets the http method the final submit of the wizard uses. When left unset
        /// it follows the mode.
        /// </summary>
        Func<IRenderControlContext, RequestMethod> Method { get; }

        /// <summary>
        /// Gets the collection of wizard pages associated with the control.
        /// </summary>
        IEnumerable<IControlDataWizardPage> Pages { get; }

        /// <summary>
        /// Gets a delegate that returns the unique identifier for an item within 
        /// the specified render control context.
        /// </summary>
        Func<IRenderControlContext, string> ItemId { get; }

        /// <summary>
        /// Gets the label of the button that leaves the wizard on its last step.
        /// </summary>
        Func<IRenderControlContext, string> FinishLabel { get; }

        /// <summary>
        /// Gets the icon of the button that leaves the wizard on its last step.
        /// </summary>
        Func<IRenderControlContext, IIcon> FinishIcon { get; }

        /// <summary>
        /// Adds one or more pages to the wizard control.
        /// </summary>
        /// <param name="pages">The pages to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlDataWizard Add(params IControlDataWizardPage[] pages);

        /// <summary>
        /// Adds one or more pages to the wizard control.
        /// </summary>
        /// <param name="pages">The pages to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlDataWizard Add(IEnumerable<IControlDataWizardPage> pages);

        /// <summary>
        /// Removes the specified page from the wizard control.
        /// </summary>
        /// <param name="page">The page to remove.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlDataWizard Remove(IControlDataWizardPage page);
    }
}