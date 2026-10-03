using System;
using System.Collections.Generic;
using WebExpress.WebApp.WebData;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// A sidebar whose navigation items are supplied by a REST endpoint rather
    /// than authored statically. The control renders only the host element and
    /// its data islands; the client controller (wx-webapp-sidebar) queries the
    /// service, maps the response into hierarchical items with badges and hands
    /// them to the shared WebUI sidebar for rendering and responsive behavior.
    /// </summary>
    public class ControlDataSidebar : Control, IControlData, IDataIsland
    {
        /// <summary>
        /// Gets the data service descriptors of the control, emitted as
        /// wx-service island elements. The data service supplies the sidebar
        /// items; a plain GET is the common shape, so <see cref="DataServiceDescriptor.QueryData"/>
        /// is the usual factory.
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
        /// Gets or sets the optional initial state. When it carries items the
        /// client renders them on the first paint and skips the load on mount,
        /// so server side data avoids a round trip.
        /// </summary>
        public Func<IRenderControlContext, DataState> StateFactory { get; set; }

        /// <summary>
        /// Gets or sets the width in pixels below which the sidebar collapses to
        /// its reduced (icon only) form. A negative value leaves the client
        /// default in place.
        /// </summary>
        public Func<IRenderControlContext, int> Breakpoint { get; set; } = _ => -1;

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlDataSidebar(string id = null)
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
            var breakpoint = Breakpoint?.Invoke(renderContext) ?? -1;

            var html = new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-sidebar", GetClasses(renderContext)),
                Style = GetStyles(renderContext)
            }
                .AddUserAttribute("data-breakpoint", breakpoint >= 0 ? breakpoint.ToString() : null);

            html.EmitDataIslands(this, renderContext);

            return html;
        }
    }
}
