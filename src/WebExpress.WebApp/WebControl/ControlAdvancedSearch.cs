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
    /// Represents a combined search control that integrates a basic search 
    /// input and an advanced WQL prompt into a single, user-toggleable 
    /// component. The control listens for webexpress.webui.Event.CHANGE_FILTER_EVENT from the
    /// basic search and webexpress.webapp.Event.WQL_FILTER_EVENT from the WQL
    /// prompt, normalizes their payloads and re-emits a unified
    /// webexpress.webui.Event.CHANGE_FILTER_EVENT.
    /// </summary>
    public class ControlAdvancedSearch : Control, IControlSearch, IDataIsland, IViewStateModelBound
    {
        private readonly List<IControl> _content = [];

        /// <summary>
        /// Gets or sets the resolver of the ViewState resource the search drives.
        /// When set through Resource&lt;TResource&gt;(), a search or WQL change
        /// writes the search and wql state keys and re-queries this resource; when
        /// null, the search is standalone and coordinates through the change filter
        /// event and the BindSearch bind.
        /// </summary>
        public Func<IRenderControlContext, string> ResourceFactory { get; set; }

        /// <summary>
        /// Gets or sets the optional ViewState id the search binds to. When null, the
        /// search resolves its ViewState by the resource it drives.
        /// </summary>
        public Func<IRenderControlContext, string> ViewState { get; set; }

        /// <summary>
        /// Gets or sets the resolver of the state path a basic search writes into,
        /// set through Model(...) and defaulting to "search" on the client; a WQL
        /// change always writes the "wql" key, mirroring the query state contract.
        /// </summary>
        public Func<IRenderControlContext, string> ModelFactory { get; set; }

        /// <summary>
        /// Gets the data service descriptors of the control, emitted as
        /// wx-service island elements. The data service backs the embedded WQL
        /// prompt.
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
        /// Gets the content of the control (e.g., save button).
        /// </summary>
        public IEnumerable<IControl> Content => _content;

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlAdvancedSearch(string id = null)
            : base(id ?? RandomId.Create())
        {
        }

        /// <summary>
        /// Adds one or more controls to the search control.
        /// </summary>
        /// <param name="controls">The items to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlSearch Add(params IControl[] controls)
        {
            _content.AddRange(controls);

            return this;
        }

        /// <summary>
        /// Adds one or more controls to the search control.
        /// </summary>
        /// <param name="controls">The controls to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlSearch Add(IEnumerable<IControl> controls)
        {
            _content.AddRange(controls);

            return this;
        }

        /// <summary>
        /// Removes the specified control from the view control.
        /// </summary>
        /// <param name="control">The control to remove.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlSearch Remove(IControl control)
        {
            _content.Remove(control);

            return this;
        }

        /// <summary>
        /// Converts the control to an HTML representation.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <param name="visualTree">The visual tree.</param>
        /// <returns>An HTML node representing the rendered control.</returns>
        public override IHtmlNode Render(IRenderControlContext renderContext, IVisualTreeControl visualTree)
        {
            return Render(renderContext, visualTree, [.. Content]);
        }

        /// <summary>
        /// Converts the control to an HTML representation.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <param name="visualTree">The visual tree.</param>
        /// <param name="controls">The controls to render within the search control.</param>
        /// <returns>An HTML node representing the rendered control.</returns>
        public virtual IHtmlNode Render(IRenderControlContext renderContext, IVisualTreeControl visualTree, params IControl[] controls)
        {
            var html = new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-search", GetClasses(renderContext)),
                Style = GetStyles(renderContext)
            }
                .Add(controls.Select(x => x.Render(renderContext, visualTree)))
                .EmitDataIslands(this, renderContext);

            return html;
        }
    }
}