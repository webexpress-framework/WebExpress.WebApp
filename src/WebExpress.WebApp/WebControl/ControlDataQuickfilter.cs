using System;
using System.Collections.Generic;
using System.Linq;
using WebExpress.WebApp.WebData;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents a control panel for API quickfilter interactions.
    /// </summary>
    public class ControlDataQuickfilter : ControlQuickfilter, IControlDataQuickfilter, IDataIsland, IViewStateModelBound
    {
        /// <summary>
        /// Gets or sets the resolver of the ViewState resource the quickfilter
        /// drives. When set through Resource&lt;TResource&gt;(), the quickfilter
        /// writes the active filter into the shared state and re-queries this
        /// resource; when null, the quickfilter is standalone and coordinates
        /// through the change filter event and the BindFilter bind.
        /// </summary>
        public Func<IRenderControlContext, string> ResourceFactory { get; set; }

        /// <summary>
        /// Gets or sets the optional ViewState id the quickfilter binds to. When
        /// null, the quickfilter resolves its ViewState by the resource it drives.
        /// </summary>
        public Func<IRenderControlContext, string> ViewState { get; set; }

        /// <summary>
        /// Gets or sets the resolver of the state path the quickfilter writes the
        /// active filter into, set through Model(...) and defaulting to "filter"
        /// on the client when the surface is bound but no path is declared.
        /// </summary>
        public Func<IRenderControlContext, string> ModelFactory { get; set; }

        /// <summary>
        /// Gets the data service descriptors of the control, emitted as
        /// wx-service island elements. The data service loads the filter
        /// definitions.
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
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlDataQuickfilter(string id = null)
            : base(id ?? RandomId.Create())
        {
        }

        /// <summary>
        /// Converts the control to an HTML representation.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <param name="visualTree">The visual tree.</param>
        /// <returns>An HTML node representing the rendered control.</returns>
        public override IHtmlNode Render(IRenderControlContext renderContext, IVisualTreeControl visualTree)
        {
            return Render(renderContext, visualTree, Items);
        }

        /// <summary>
        /// Converts the control to an HTML representation.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <param name="visualTree">The visual tree.</param>
        /// <param name="items">The quickfilter items to render.</param>
        /// <returns>An HTML node representing the rendered control.</returns>
        public virtual IHtmlNode Render(IRenderControlContext renderContext, IVisualTreeControl visualTree, IEnumerable<IControlQuickfilterItem> items)
        {
            var html = new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-quickfilter", GetClasses(renderContext)),
                Style = GetStyles(renderContext)
            }
                .Add(items.Select(x => x.Render(renderContext, visualTree)))
                // this control builds its own element instead of taking the base one, so the
                // prototype the base emits has to be carried over by hand; without it the chips
                // the user defined offer removing but no editing
                .Add(RenderEditAction(renderContext))
                .EmitDataIslands(this, renderContext);

            return html;
        }
    }
}