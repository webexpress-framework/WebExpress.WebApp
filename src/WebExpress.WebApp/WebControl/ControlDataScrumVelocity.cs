using System;
using System.Collections.Generic;
using WebExpress.WebApp.WebData;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Renders the host element for a scrum velocity chart. The control only
    /// emits the placeholder div; the bar chart of the last few sprints, drawn
    /// from the completed story points per sprint with the committed points as a
    /// backdrop and an average line, is built by the client-side
    /// <c>webexpress.webapp.ScrumVelocityCtrl</c>, which talks to the configured
    /// data service to load the sprint history.
    /// </summary>
    /// <remarks>
    /// The control is scope-capable: bound to a resource of an enclosing
    /// <see cref="ControlViewState"/> scope through <c>Resource&lt;TResource&gt;()</c>,
    /// it emits only the <c>data-wx-resource</c> binding and renders the slice the
    /// scope loads centrally; left unbound it owns its <c>wx-service</c> island and
    /// loads itself (standalone). The path is chosen automatically by
    /// <see cref="DataIslandExtensions.EmitDataIslands"/>.
    /// </remarks>
    public class ControlDataScrumVelocity : Control, IControlDataScrumVelocity, IDataIsland, IScopeBound
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
        /// wx-service island elements. The data service loads the recent sprints
        /// with their committed and completed story points.
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
        /// Gets or sets the maximum number of most recent sprints rendered in the
        /// chart. Defaults to <c>6</c> on the client side when not provided.
        /// </summary>
        public Func<IRenderControlContext, int?> MaxSprints { get; set; }

        /// <summary>
        /// Gets or sets the color of the completed (velocity) bars. Accepts a
        /// system color (emitted as a CSS class) or a user-defined color (emitted
        /// as an inline style), exactly like a control button. When not set, the
        /// stylesheet default applies.
        /// </summary>
        public Func<IRenderControlContext, PropertyColorBackground> ColorCompleted { get; set; }

        /// <summary>
        /// Gets or sets the color of the committed backdrop bars. When not set,
        /// the stylesheet default applies.
        /// </summary>
        public Func<IRenderControlContext, PropertyColorBackground> ColorCommitted { get; set; }

        /// <summary>
        /// Gets or sets the color of the average line. When not set, the
        /// stylesheet default applies.
        /// </summary>
        public Func<IRenderControlContext, PropertyColorBackground> ColorAverage { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">Optional host element id.</param>
        public ControlDataScrumVelocity(string id = null)
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

            var maxSprints = MaxSprints?.Invoke(renderContext);
            var colorCompleted = ColorCompleted?.Invoke(renderContext);
            var colorCommitted = ColorCommitted?.Invoke(renderContext);
            var colorAverage = ColorAverage?.Invoke(renderContext);

            return new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-scrum-velocity", GetClasses(renderContext)),
                Style = GetStyles(renderContext),
                Role = Role?.Invoke(renderContext)
            }
                .EmitDataIslands(this, renderContext)
                .AddUserAttribute("data-max-sprints", maxSprints?.ToString())
                .AddUserAttribute("data-color-completed-css", colorCompleted?.ToClass())
                .AddUserAttribute("data-color-completed-style", colorCompleted?.ToStyle())
                .AddUserAttribute("data-color-committed-css", colorCommitted?.ToClass())
                .AddUserAttribute("data-color-committed-style", colorCommitted?.ToStyle())
                .AddUserAttribute("data-color-average-css", colorAverage?.ToClass())
                .AddUserAttribute("data-color-average-style", colorAverage?.ToStyle());
        }
    }
}
