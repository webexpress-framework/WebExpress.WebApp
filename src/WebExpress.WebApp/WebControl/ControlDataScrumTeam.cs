using System;
using System.Collections.Generic;
using WebExpress.WebApp.WebData;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Renders the host element for a scrum team workload row. The control only
    /// emits the placeholder div; the avatar row of the people working in the
    /// current sprint, the <c>+N</c> overflow chip and the modal that lists
    /// every person with their story points as a table are built by the
    /// client-side <c>webexpress.webapp.ScrumTeamCtrl</c>, which talks to the
    /// configured data service to load the members. The layout mirrors
    /// <see cref="ControlDataWatcher"/> so the two avatar surfaces read alike.
    /// </summary>
    /// <remarks>
    /// The control is scope-capable: bound to a resource of an enclosing
    /// <see cref="ControlViewState"/> scope through <c>Resource&lt;TResource&gt;()</c>,
    /// it emits only the <c>data-wx-resource</c> binding and renders the slice the
    /// scope loads centrally; left unbound it owns its <c>wx-service</c> island and
    /// loads itself (standalone). The path is chosen automatically by
    /// <see cref="DataIslandExtensions.EmitDataIslands"/>.
    /// </remarks>
    public class ControlDataScrumTeam : Control, IControlDataScrumTeam, IDataIsland, IScopeBound
    {
        /// <summary>
        /// Gets or sets the resolver of the scope resource the control renders. Set type-safely
        /// through <c>Resource&lt;TResource&gt;()</c>. When null, the control is standalone and
        /// owns its own islands.
        /// </summary>
        public Func<IRenderControlContext, string> ResourceFactory { get; set; }

        /// <summary>
        /// Gets or sets the optional scope id the control binds to, emitted as the
        /// <c>data-wx-view</c> attribute. When null, the control resolves its scope by the
        /// resource it binds to.
        /// </summary>
        public Func<IRenderControlContext, string> Scope { get; set; }

        /// <summary>
        /// Gets the data service descriptors of the control, emitted as
        /// wx-service island elements. The data service loads the current
        /// sprint's people and their story points.
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
        /// Gets or sets the maximum number of people shown inline before they are
        /// collapsed into a <c>+N</c> overflow chip. Defaults to <c>6</c> on the
        /// client side when not provided.
        /// </summary>
        public Func<IRenderControlContext, int?> MaxVisible { get; set; }

        /// <summary>
        /// Gets or sets the color of the story point badge on each avatar. Accepts
        /// a system color (emitted as a CSS class) or a user-defined color (emitted
        /// as an inline style), exactly like a control button. When not set, the
        /// stylesheet default applies.
        /// </summary>
        public Func<IRenderControlContext, PropertyColorBackground> ColorPoints { get; set; }

        /// <summary>
        /// Gets or sets the accent color of the completed story points in the
        /// modal (the completed badge and the per-person completion bar). When not
        /// set, the stylesheet default applies.
        /// </summary>
        public Func<IRenderControlContext, PropertyColorBackground> ColorCompleted { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">Optional host element id.</param>
        public ControlDataScrumTeam(string id = null)
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
            var colorPoints = ColorPoints?.Invoke(renderContext);
            var colorCompleted = ColorCompleted?.Invoke(renderContext);

            return new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-scrum-team", GetClasses(renderContext)),
                Style = GetStyles(renderContext),
                Role = Role?.Invoke(renderContext)
            }
                .EmitDataIslands(this, renderContext)
                .AddUserAttribute("data-max-visible", maxVisible?.ToString())
                .AddUserAttribute("data-color-points-css", colorPoints?.ToClass())
                .AddUserAttribute("data-color-points-style", colorPoints?.ToStyle())
                .AddUserAttribute("data-color-completed-css", colorCompleted?.ToClass())
                .AddUserAttribute("data-color-completed-style", colorCompleted?.ToStyle());
        }
    }
}
