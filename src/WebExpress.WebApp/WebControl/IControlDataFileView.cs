using System;
using System.Collections.Generic;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Defines the contract for a REST-backed file control that presents one set
    /// of files in several interchangeable views.
    /// </summary>
    public interface IControlDataFileView : IControl, IControlData
    {
        /// <summary>
        /// Gets the files the control shows before the first response arrives,
        /// and the whole content of the control when no service is declared.
        /// </summary>
        IEnumerable<IControlFileListItem> Files { get; }

        /// <summary>
        /// Gets the additional, author-provided views the switcher offers next to
        /// the built-in ones.
        /// </summary>
        IEnumerable<IControlViewItem> Views { get; }

        /// <summary>
        /// Gets the built-in views the switcher offers, in the order they are
        /// switched through. The first one is shown until the user picks another.
        /// </summary>
        Func<IRenderControlContext, IEnumerable<TypeFileView>> Presentations { get; }

        /// <summary>
        /// Gets the layout of the view switcher.
        /// </summary>
        Func<IRenderControlContext, TypeLayoutView> Layout { get; }

        /// <summary>
        /// Gets a value indicating whether the description of a file can be
        /// changed in place, without leaving the view.
        /// </summary>
        Func<IRenderControlContext, bool> EditableDescription { get; }

        /// <summary>
        /// Gets the number of files requested per page.
        /// </summary>
        Func<IRenderControlContext, uint> PageSize { get; }

        /// <summary>
        /// Gets the binding, which is where an upload control is tied to the view
        /// so a finished upload shows up without a reload.
        /// </summary>
        Func<IRenderControlContext, IBinding> Bind { get; }

        /// <summary>
        /// Adds one or more files to the control.
        /// </summary>
        /// <param name="items">The files to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlDataFileView Add(params IControlFileListItem[] items);

        /// <summary>
        /// Adds one or more files to the control.
        /// </summary>
        /// <param name="items">The files to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlDataFileView Add(IEnumerable<IControlFileListItem> items);

        /// <summary>
        /// Adds one or more additional views to the control.
        /// </summary>
        /// <param name="views">The views to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlDataFileView Add(params IControlViewItem[] views);

        /// <summary>
        /// Adds one or more additional views to the control.
        /// </summary>
        /// <param name="views">The views to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlDataFileView Add(IEnumerable<IControlViewItem> views);

        /// <summary>
        /// Removes the specified file from the control.
        /// </summary>
        /// <param name="item">The file to remove.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlDataFileView Remove(IControlFileListItem item);

        /// <summary>
        /// Removes the specified view from the control.
        /// </summary>
        /// <param name="view">The view to remove.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlDataFileView Remove(IControlViewItem view);
    }
}
