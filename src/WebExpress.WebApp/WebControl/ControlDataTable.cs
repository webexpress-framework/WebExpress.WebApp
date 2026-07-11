using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using WebExpress.WebApp.WebData;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents a control panel for API table interactions.
    /// </summary>
    public class ControlDataTable : ControlPanel, IControlDataTable, IDataIsland, IViewStateBound
    {
        /// <summary>
        /// Retruns or sets the number of items to display on each page in a
        /// paginated collection.
        /// </summary>
        public Func<IRenderControlContext, uint> PageSize { get; set; }

        /// <summary>
        /// Gets or sets the name of the enclosing ViewState resource the table
        /// renders. When set, the table is a pure view of a central resource the
        /// ViewState owns; when null, the table owns its state and service
        /// islands and loads itself.
        /// </summary>
        public Func<IRenderControlContext, string> ResourceFactory { get; set; }

        /// <summary>
        /// Gets or sets the optional ViewState id the table binds to. When null, the
        /// table resolves the nearest enclosing ViewState by ancestry.
        /// </summary>
        public Func<IRenderControlContext, string> ViewState { get; set; }

        /// <summary>
        /// Gets or sets the binding.
        /// </summary>
        public Func<IRenderControlContext, IBinding> Bind { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether rows in the table can be reordered
        /// interactively via drag-and-drop. When enabled, the client emits a PUT to the
        /// configured REST endpoint with the new row order (see <c>RestApiTable.Configure</c>).
        /// </summary>
        public Func<IRenderControlContext, bool> MovableRow { get; set; }

        /// <summary>
        /// Gets the data service descriptors of the control, emitted together as
        /// the data-wx-service island that the JavaScript engine consumes in
        /// preference to the legacy data-uri fallback, which keeps the endpoint
        /// and parameter knowledge authored in C#. When empty, the control
        /// behaves exactly as before and the client uses its legacy descriptor.
        /// See WebExpress/docs/view-state-service.md.
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
        /// data-wx-template attribute that the client Templates registry
        /// resolves into a registered view.
        /// </summary>
        public Func<IRenderControlContext, string> TemplateFactory { get; set; }

        /// <summary>
        /// Gets or sets the optional initial state, emitted as the data-wx-state island.
        /// </summary>
        public Func<IRenderControlContext, DataState> StateFactory { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlDataTable(string id = null)
            : base(id ?? RandomId.Create())
        {
        }

        /// <summary>
        /// Converts the control to an HTML representation.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <returns>An HTML node representing the rendered control.</returns>
        public override IHtmlNode Render(IRenderControlContext renderContext, IVisualTreeControl visualTree)
        {
            var pageSize = PageSize?.Invoke(renderContext);
            var bind = Bind?.Invoke(renderContext);

            var html = new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-table", GetClasses(renderContext)),
                Style = GetStyles(renderContext)
            }
                .AddUserAttribute("data-page-size", pageSize > 0 ? pageSize.ToString() : null)
                .AddUserAttribute("data-movable-row", MovableRow?.Invoke(renderContext) == true ? "true" : null)
                .EmitDataIslands(this, renderContext);

            bind?.ApplyUserAttributes(html);

            return new HtmlList(html, Content.Select
            (
                x => x.Render(renderContext, visualTree))
            );
        }
    }
}
