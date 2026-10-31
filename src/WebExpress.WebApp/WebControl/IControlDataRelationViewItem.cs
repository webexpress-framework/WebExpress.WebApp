using System;
using System.Collections.Generic;
using WebExpress.WebCore.WebIcon;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Contract for a further presentation of the relation surface. The surface
    /// itself brings the list and the graph; a view like this adds one more way
    /// of reading the same relations - a timeline, a matrix, an impact analysis -
    /// and appears next to them in the presentation switch.
    ///
    /// A view is rendered on the server and handed to the client as a pane; the
    /// client only shows and hides it. That keeps a contributed view free to use
    /// any control of the framework, because it does not have to be expressible
    /// in the client model of the surface.
    /// </summary>
    public interface IControlDataRelationViewItem : IControl
    {
        /// <summary>
        /// Gets the token the presentation is selected by. It is what the surface
        /// stores as its current view, so it has to be stable and must not
        /// collide with the built-in <c>list</c> and <c>graph</c>.
        /// </summary>
        string View { get; }

        /// <summary>
        /// Gets the caption of the presentation in the switch.
        /// </summary>
        Func<IRenderControlContext, string> Label { get; }

        /// <summary>
        /// Gets the icon of the presentation in the switch.
        /// </summary>
        Func<IRenderControlContext, IIcon> Icon { get; }

        /// <summary>
        /// Gets the content of the presentation.
        /// </summary>
        IEnumerable<IControl> Content { get; }

        /// <summary>
        /// Adds one or more controls to the presentation.
        /// </summary>
        /// <param name="items">The controls to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlDataRelationViewItem Add(params IControl[] items);

        /// <summary>
        /// Adds one or more controls to the presentation.
        /// </summary>
        /// <param name="items">The controls to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        IControlDataRelationViewItem Add(IEnumerable<IControl> items);
    }
}
