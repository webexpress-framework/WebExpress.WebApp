using System;
using System.Collections.Generic;
using System.Linq;
using WebExpress.WebApp.WebData;
using WebExpress.WebApp.WebFragment;
using WebExpress.WebApp.WebSection;
using WebExpress.WebCore;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebScope;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Renders the host element of the link surface of one object: the relations
    /// it holds to other objects and to addresses outside the application,
    /// grouped by relation and rendered as a list or as a graph, with the dialog
    /// that establishes a new one and the dialog that shows what one link
    /// carries.
    ///
    /// The control only emits the placeholder div; the surface itself is built by
    /// the client-side <c>webexpress.webapp.RelationViewCtrl</c>, which reads the links
    /// from the data service, the offered link systems from the systems service
    /// and the candidates of the target search from the targets service. Which
    /// systems and which relations exist is answered by the server at request
    /// time, so a relation a plugin contributed appears here without a change to
    /// this control.
    /// </summary>
    /// <remarks>
    /// The control is ViewState-capable: bound to a resource of an enclosing
    /// <see cref="ControlViewState"/> ViewState through <c>Resource&lt;TResource&gt;()</c>,
    /// it emits only the <c>data-wx-resource</c> binding and renders the slice the
    /// ViewState loads centrally, while additions and removals still persist through
    /// the ViewState's data service; left unbound it owns its <c>wx-service</c> islands
    /// and loads itself (standalone). The path is chosen automatically by
    /// <see cref="DataIslandExtensions.EmitDataIslands"/>.
    /// </remarks>
    public class ControlDataRelationView : Control, IControlData, IDataIsland, IViewStateBound, IScope
    {
        private readonly List<IControlDataRelationViewItem> _views = [];

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
        /// wx-service island elements: the data service backs the links, the
        /// systems service the sidebar of the add dialog and the targets service
        /// the search for the object a link points at.
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
        /// Gets or sets the business key of the object the surface belongs to.
        /// The client renders it in the footer of the add dialog, so the user
        /// reads the sentence the link will state before confirming it.
        /// </summary>
        public Func<IRenderControlContext, string> Subject { get; set; }

        /// <summary>
        /// Gets or sets the class of the object the surface belongs to, which
        /// decides which relations the dialog may offer.
        /// </summary>
        public Func<IRenderControlContext, string> SubjectClass { get; set; }

        /// <summary>
        /// Gets or sets the presentation the surface opens with, <c>list</c> or
        /// <c>graph</c>. Defaults to the list on the client side.
        /// </summary>
        public Func<IRenderControlContext, string> View { get; set; }

        /// <summary>
        /// Gets or sets how the surface presents itself: as a card, or flat as a
        /// section of the page it sits in.
        /// </summary>
        public Func<IRenderControlContext, TypeLayoutRelationView> Layout { get; set; } = _ => TypeLayoutRelationView.Default;

        /// <summary>
        /// Gets or sets a value indicating whether the header shows the icon of
        /// the surface. Defaults to <see langword="true"/>; a page that already
        /// names the section around the surface turns it off.
        /// </summary>
        public Func<IRenderControlContext, bool> HeaderIcon { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether the header shows its caption.
        /// Defaults to <see langword="true"/>.
        /// </summary>
        public Func<IRenderControlContext, bool> HeaderText { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether the header shows how many
        /// relations the surface holds. Defaults to <see langword="true"/>.
        /// </summary>
        public Func<IRenderControlContext, bool> HeaderBadge { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether the surface is read-only. When
        /// <see langword="true"/>, the add affordance and the per-row options are
        /// suppressed and the links are rendered for reading only.
        /// </summary>
        public Func<IRenderControlContext, bool> Readonly { get; set; }

        /// <summary>
        /// Gets the further presentations the page added, rendered as panes next
        /// to the built-in list and graph. A presentation contributed through a
        /// fragment needs no entry here; it is collected at render time.
        /// </summary>
        public IEnumerable<IControlDataRelationViewItem> Views => _views;

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">Optional host element id.</param>
        public ControlDataRelationView(string id = null)
            : base(id)
        {
        }

        /// <summary>
        /// Adds one or more presentations to the surface.
        /// </summary>
        /// <param name="views">The presentations to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        public ControlDataRelationView Add(params IControlDataRelationViewItem[] views)
        {
            _views.AddRange(views);

            return this;
        }

        /// <summary>
        /// Adds one or more presentations to the surface.
        /// </summary>
        /// <param name="views">The presentations to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        public ControlDataRelationView Add(IEnumerable<IControlDataRelationViewItem> views)
        {
            _views.AddRange(views);

            return this;
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

            var readOnly = Readonly?.Invoke(renderContext) ?? false;
            var layout = Layout?.Invoke(renderContext) ?? TypeLayoutRelationView.Default;
            var fragmentManager = WebEx.ComponentHub.FragmentManager;
            var applicationContext = renderContext?.PageContext?.ApplicationContext;

            // the presentations a plugin contributed, in the three placements the
            // sections offer: before the ones the page declared, between them and
            // the built-in switch, and after everything
            var preferences = fragmentManager.GetFragments<IFragmentControlDataRelationViewItem, SectionRelationViewPreferences>
            (
                applicationContext,
                [GetType()]
            );
            var primary = fragmentManager.GetFragments<IFragmentControlDataRelationViewItem, SectionRelationViewPrimary>
            (
                applicationContext,
                [GetType()]
            );
            var secondary = fragmentManager.GetFragments<IFragmentControlDataRelationViewItem, SectionRelationViewSecondary>
            (
                applicationContext,
                [GetType()]
            );

            // the islands are prepended by the emission below, so the panes may
            // be the content the host is built with
            var panes = preferences
                .Concat(primary)
                .Select(x => x.Render(renderContext, visualTree))
                .Concat(_views.Select(x => x.Render(renderContext, visualTree)))
                .Concat(secondary.Select(x => x.Render(renderContext, visualTree)))
                .Where(x => x != null)
                .ToArray();

            return new HtmlElementTextContentDiv(panes)
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-relation-view", layout.ToClass(), GetClasses(renderContext)),
                Style = GetStyles(renderContext),
                Role = Role?.Invoke(renderContext)
            }
                .EmitDataIslands(this, renderContext)
                .AddUserAttribute("data-subject", Subject?.Invoke(renderContext))
                .AddUserAttribute("data-subject-class", SubjectClass?.Invoke(renderContext))
                .AddUserAttribute("data-view", View?.Invoke(renderContext))
                .AddUserAttribute("data-readonly", readOnly ? "true" : null)
                .AddUserAttribute("data-header-icon", HeaderIcon?.Invoke(renderContext) == false ? "false" : null)
                .AddUserAttribute("data-header-text", HeaderText?.Invoke(renderContext) == false ? "false" : null)
                .AddUserAttribute("data-header-badge", HeaderBadge?.Invoke(renderContext) == false ? "false" : null);
        }
    }
}
