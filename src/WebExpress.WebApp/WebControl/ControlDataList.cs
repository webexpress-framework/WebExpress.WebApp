using System;
using System.Collections.Generic;
using System.Linq;
using WebExpress.WebApp.WebData;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents a control panel for API list interactions.
    /// </summary>
    public class ControlDataList : ControlList, IControlDataList, IDataIsland, IViewStateBound
    {
        /// <summary>
        /// Gets or sets the binding.
        /// </summary>
        public Func<IRenderControlContext, IBinding> Bind { get; set; }

        /// <summary>
        /// Gets or sets the name of the enclosing ViewState resource the list
        /// renders. When set, the list is a pure view of a central resource the
        /// ViewState owns; when null, the list owns its state and service
        /// islands and loads itself.
        /// </summary>
        public Func<IRenderControlContext, string> ResourceFactory { get; set; }

        /// <summary>
        /// Gets or sets the optional ViewState id the list binds to. When null, the
        /// list resolves the nearest enclosing ViewState by ancestry.
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
        /// Gets or sets the optional initial state. When set, the control emits a
        /// data-wx-state island that the JavaScript Component seeds its store
        /// from on the first render, so the first paint can avoid a round trip.
        /// See WebExpress/docs/view-state-service.md.
        /// </summary>
        public Func<IRenderControlContext, DataState> StateFactory { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlDataList(string id = null)
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
            var selectable = Selectable?.Invoke(renderContext) ?? false;
            var title = Title?.Invoke(renderContext);
            var sortable = Sortable?.Invoke(renderContext) ?? false;
            var layout = Layout?.Invoke(renderContext);
            var bind = Bind?.Invoke(renderContext);

            var html = new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-list", GetClasses(renderContext)),
                Style = GetStyles(renderContext)
            }
                .AddUserAttribute("data-title", I18N.Translate(renderContext, title))
                .AddUserAttribute("data-sortable", sortable ? "true" : null)
                .AddUserAttribute("data-selectable", selectable ? "true" : null)
                .AddUserAttribute("data-layout", layout?.ToClass())
                .Add(Items.Select(x => x.Render(renderContext, visualTree)));

            html.EmitDataIslands(this, renderContext);

            bind?.ApplyUserAttributes(html);

            return html;
        }
    }
}