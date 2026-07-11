using System;
using System.Collections.Generic;
using System.Net;
using WebExpress.WebApp.WebData;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents a control panel for API workflow interactions.
    /// </summary>
    /// <remarks>
    /// The control is ViewState-capable: bound to a resource of an enclosing
    /// <see cref="ControlViewState"/> ViewState through <c>Resource&lt;TResource&gt;()</c>,
    /// it emits only the <c>data-wx-resource</c> binding and renders the slice the
    /// ViewState loads centrally, while the debounced autosave still persists through
    /// the ViewState's data service; left unbound it owns its <c>wx-service</c> island
    /// and loads itself (standalone). The path is chosen automatically by
    /// <see cref="DataIslandExtensions.EmitDataIslands"/>.
    /// </remarks>
    public class ControlDataWorkflow : ControlPanel, IControlDataWorkflow, IDataIsland, IViewStateBound
    {
        /// <summary>
        /// Gets or sets the resolver of the ViewState resource the control renders. Set type-safely
        /// through <c>Resource&lt;TResource&gt;()</c>. When null, the control is standalone and
        /// owns its own islands.
        /// </summary>
        public Func<IRenderControlContext, string> ResourceFactory { get; set; }

        /// <summary>
        /// Gets or sets the optional ViewState id the control binds to, emitted as the
        /// <c>data-wx-viewstate</c> attribute. When null, the control resolves its ViewState by the
        /// resource it binds to.
        /// </summary>
        public Func<IRenderControlContext, string> ViewState { get; set; }

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
        public ControlDataWorkflow(string id = null)
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

            var html = new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-workflow-editor", GetClasses(renderContext)),
                Style = GetStyles(renderContext)
            }
                .EmitDataIslands(this, renderContext);

            return html;
        }
    }
}