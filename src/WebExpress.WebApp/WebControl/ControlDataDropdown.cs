using System;
using System.Collections.Generic;
using WebExpress.WebApp.WebControl;
using WebExpress.WebApp.WebData;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebApiControl
{
    /// <summary>
    /// Represents a dropdown control that can be rendered as HTML within a RESTful web application context.
    /// </summary>
    /// <remarks>
    /// The control is ViewState-capable: bound to a resource of an enclosing
    /// <see cref="ControlViewState"/> ViewState through <c>Resource&lt;TResource&gt;()</c>,
    /// it emits only the <c>data-wx-resource</c> binding and renders the slice the
    /// ViewState loads centrally, while a remote search still queries through the
    /// ViewState's data service; left unbound it owns its <c>wx-service</c> island and
    /// loads itself (standalone). The path is chosen automatically by
    /// <see cref="DataIslandExtensions.EmitDataIslands"/>.
    /// </remarks>
    public class ControlDataDropdown : ControlDropdown, IControlData, IDataIsland, IViewStateBound
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
        /// Gets the data service descriptors of the control, emitted as
        /// wx-service island elements. The data service populates the dropdown.
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
        /// Gets or sets the maximum number of entries to display (default 25).
        /// </summary>
        public Func<IRenderControlContext, int> MaxItems { get; set; } = _ => -1;

        /// <summary>
        /// Gets or sets the placeholder text for the search input.
        /// </summary>
        public Func<IRenderControlContext, string> SearchPlaceholder { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlDataDropdown(string id = null)
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
            var searchPlaceholder = SearchPlaceholder?.Invoke(renderContext);

            // create host element for the remote dropdown controller
            var html = base.Render(renderContext, visualTree)
                .AddClass("wx-webapp-dropdown")
                .RemoveClass("wx-webui-dropdown")
                .EmitDataIslands(this, renderContext)
                .AddUserAttribute("data-maxItems", maxItems > 0 ? maxItems.ToString() : null)
                .AddUserAttribute("data-searchPlaceholder", I18N.Translate(renderContext, searchPlaceholder));

            return html;
        }
    }
}