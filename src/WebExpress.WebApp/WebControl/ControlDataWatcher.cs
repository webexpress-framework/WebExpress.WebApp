using System;
using System.Collections.Generic;
using WebExpress.WebApp.WebData;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Renders the host element for an watcher avatar row. The
    /// control only emits the placeholder div; the actual avatar row, the
    /// "+" affordance and the search dropdown are built by the client-side
    /// <c>webexpress.webapp.WatcherCtrl</c>, which talks to the configured
    /// data and users services to load, add, remove and resolve watchers.
    /// </summary>
    /// <remarks>
    /// The control is ViewState-capable: bound to a resource of an enclosing
    /// <see cref="ControlViewState"/> ViewState through <c>Resource&lt;TResource&gt;()</c>,
    /// it emits only the <c>data-wx-resource</c> binding (and the users service
    /// bound with <c>UsersService&lt;TEndpoint&gt;()</c>) and renders the slice the
    /// ViewState loads centrally, while additions and removals still persist through
    /// the ViewState's data service; left unbound it owns its <c>wx-service</c> islands
    /// and loads itself (standalone). The path is chosen automatically by
    /// <see cref="DataIslandExtensions.EmitDataIslands"/>.
    /// </remarks>
    public class ControlDataWatcher : Control, IDataIsland, IViewStateBoundUsers
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
        /// Gets or sets the resolver of the ViewState users service the candidate
        /// search uses, set type-safely through UsersService&lt;TEndpoint&gt;().
        /// </summary>
        public Func<IRenderControlContext, string> UsersFactory { get; set; }

        /// <summary>
        /// Gets the data service descriptors of the control, emitted as
        /// wx-service island elements: the data service backs the watcher list
        /// and the optional users service backs the candidate search.
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
        /// Gets or sets the maximum number of avatars shown inline before
        /// they are collapsed into a <c>+N</c> overflow chip. Defaults to
        /// <c>6</c> on the client side when not provided.
        /// </summary>
        public Func<IRenderControlContext, int?> MaxVisible { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether the surface is read-only.
        /// When <see langword="true"/>, the "+" affordance and the
        /// click-to-remove behavior on the avatars are suppressed.
        /// </summary>
        public Func<IRenderControlContext, bool> Readonly { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">Optional host element id.</param>
        public ControlDataWatcher(string id = null)
            : base(id)
        {
        }

        /// <summary>
        /// Converts the control to its HTML representation.
        /// </summary>
        /// <param name="renderContext">The render context.</param>
        /// <param name="visualTree">The visual tree.</param>
        /// <returns>The rendered HTML node.</returns>
        public override IHtmlNode Render(IRenderControlContext renderContext, IVisualTreeControl visualTree)
        {
            var enable = Enable?.Invoke(renderContext) ?? true;
            if (!enable)
            {
                return null;
            }

            var maxVisible = MaxVisible?.Invoke(renderContext);
            var readOnly = Readonly?.Invoke(renderContext) ?? false;

            return new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-watcher", GetClasses(renderContext)),
                Style = GetStyles(renderContext),
                Role = Role?.Invoke(renderContext)
            }
                .EmitDataIslands(this, renderContext)
                .AddUserAttribute("data-max-visible", maxVisible?.ToString())
                .AddUserAttribute("data-readonly", readOnly ? "true" : null);
        }
    }
}
