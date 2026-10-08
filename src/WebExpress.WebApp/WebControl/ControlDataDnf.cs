using System;
using System.Collections.Generic;
using WebExpress.WebApp.WebData;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents a read only disjunctive normal form view that resolves its term
    /// labels through a specified endpoint.
    /// </summary>
    /// <remarks>
    /// An expression stores term ids, so a view without terms renders the ids
    /// themselves - readable to the database, not to the reader. This control
    /// queries the term set, which is what a read state whose terms are too many to
    /// embed needs, and what the smart edit turns into an editor.
    /// </remarks>
    public class ControlDataDnf : ControlDnf, IControlData, IDataIsland
    {
        /// <summary>
        /// Gets the data service descriptors of the control, emitted as
        /// wx-service island elements. The data service queries the terms.
        /// </summary>
        public IList<Func<IRenderControlContext, DataServiceDescriptor>> ServiceFactories { get; } = [];

        /// <summary>
        /// Gets or sets the single data service descriptor, as a convenience for
        /// the common control with exactly one service. Reading returns the
        /// first declared service, assigning replaces all declared services.
        /// </summary>
        public Func<IRenderControlContext, DataServiceDescriptor> ServiceFactory
        {
            get => ServiceFactories.Count > 0 ? ServiceFactories[0] : null;
            set
            {
                ServiceFactories.Clear();

                if (value != null)
                {
                    ServiceFactories.Add(value);
                }
            }
        }

        /// <summary>
        /// Gets or sets the optional template reference, emitted as the
        /// data-wx-template attribute.
        /// </summary>
        public Func<IRenderControlContext, string> TemplateFactory { get; set; }

        /// <summary>
        /// Gets or sets the optional initial state, emitted as the wx-state island.
        /// </summary>
        public Func<IRenderControlContext, DataState> StateFactory { get; set; }

        /// <summary>
        /// Gets or sets the maximum number of terms to resolve.
        /// </summary>
        public Func<IRenderControlContext, int> MaxItems { get; set; } = _ => -1;

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The id of the control.</param>
        public ControlDataDnf(string id = null)
            : base(id)
        {
        }

        /// <summary>
        /// Converts the control to an HTML representation.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <param name="visualTree">The visual tree representing the control's structure.</param>
        /// <returns>An HTML node representing the rendered control.</returns>
        public override IHtmlNode Render(IRenderControlContext renderContext, IVisualTreeControl visualTree)
        {
            var maxItems = MaxItems?.Invoke(renderContext) ?? -1;

            return base.Render(renderContext, visualTree)
                .AddClass("wx-webapp-dnf")
                .RemoveClass("wx-webui-dnf")
                .EmitDataIslands(this, renderContext)
                .AddUserAttribute("data-maxItems", maxItems > 0 ? maxItems.ToString() : null);
        }
    }
}
