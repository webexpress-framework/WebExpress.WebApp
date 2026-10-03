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
    /// The ViewState host. It wraps a region of the page in a single source
    /// of truth: it declares the ViewState state, the ViewState services and the ViewState
    /// resources, and it renders its child controls inside the ViewState element. The
    /// JavaScript ViewState instantiated for this element loads the resources
    /// centrally, and every control in the ViewState subscribes to the shared state
    /// and re-renders when it changes, instead of each control owning a private
    /// store and loading itself.
    ///
    /// Because the host wraps its controls, a control resolves its ViewState by walking
    /// up to the nearest enclosing host, and ViewStates nest. The page is simply the
    /// outermost ViewState. Author the ViewState as one chain, for example
    /// new ControlViewState("orders", list, pager).State(...).Service(...).Resource(...).
    /// See WebExpress/docs/view-state-service.md.
    /// </summary>
    public class ControlViewState : ControlPanel, IViewState
    {
        /// <summary>
        /// Gets the data service descriptors of the ViewState, emitted as one
        /// wx-service island element per service.
        /// </summary>
        public IList<Func<IRenderControlContext, DataServiceDescriptor>> ServiceFactories { get; } = [];

        /// <summary>
        /// Gets or sets the single data service descriptor, as a convenience for
        /// the common ViewState with exactly one service. Reading returns the first
        /// declared service, assigning replaces all declared services.
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
        /// Gets or sets the optional initial ViewState state, emitted as the wx-state
        /// island the ViewState seeds from on the first render.
        /// </summary>
        public Func<IRenderControlContext, DataState> StateFactory { get; set; }

        /// <summary>
        /// Gets the resource descriptors of the ViewState, emitted as one wx-resource
        /// island element per resource.
        /// </summary>
        public IList<Func<IRenderControlContext, DataResourceDescriptor>> ResourceFactories { get; } = [];

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The ViewState id, used as the data-wx-viewstate identifier.</param>
        /// <param name="controls">The child controls of the ViewState.</param>
        public ControlViewState(string id = null, params IControl[] controls)
            : base(id ?? RandomId.Create(), controls)
        {
        }

        /// <summary>
        /// Converts the control to an HTML representation. It renders the child
        /// controls inside the ViewState element, marks the element with its ViewState id,
        /// and emits the state, service and resource islands at the start of the
        /// element, so the JavaScript ViewState seeds, configures and loads the
        /// ViewState from a single host.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <param name="visualTree">The visual tree.</param>
        /// <returns>An HTML node representing the rendered control.</returns>
        public override IHtmlNode Render(IRenderControlContext renderContext, IVisualTreeControl visualTree)
        {
            var html = new HtmlElementTextContentDiv([.. Content.Select(x => x?.Render(renderContext, visualTree))])
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-viewstate", GetClasses(renderContext)),
                Style = GetStyles(renderContext)
            }
                .AddUserAttribute("data-wx-viewstate", Id);

            var resources = ResourceFactories
                .Select(factory => factory?.Invoke(renderContext))
                .Where(descriptor => descriptor != null)
                .ToArray();

            html.EmitDataIslands(this, renderContext)
                .EmitResourceIslands(resources);

            return html;
        }
    }
}
