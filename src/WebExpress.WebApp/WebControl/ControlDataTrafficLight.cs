using System;
using System.Collections.Generic;
using WebExpress.WebApp.WebData;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Renders the host element for a REST-backed traffic light surface. The
    /// control only emits the placeholder div and its data islands; the lit
    /// lamp, the optional interaction and the persistence are handled by the
    /// client-side <c>webexpress.webapp.TrafficLightCtrl</c>, which renders the
    /// read-only or the interactive representation and talks to the configured
    /// REST endpoint to load the current state (GET) and persist a change (PUT).
    /// </summary>
    /// <remarks>
    /// The control is ViewState-capable: bound to a resource of an enclosing
    /// <see cref="ControlViewState"/> ViewState through <c>Resource&lt;TResource&gt;()</c>,
    /// it emits only the <c>data-wx-resource</c> binding and renders the slice the
    /// ViewState loads centrally; left unbound it owns its <c>wx-service</c> island and
    /// loads itself (standalone). The path is chosen automatically by
    /// <see cref="DataIslandExtensions.EmitDataIslands"/>.
    /// </remarks>
    public class ControlDataTrafficLight : Control, IControlData, IDataIsland, IViewStateBound
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
        /// wx-service island elements. The data service backs the load and the
        /// persistence of the status.
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
        /// Gets or sets the initial lit lamp, rendered server-side into the
        /// <c>data-value</c> attribute to avoid a flash before the REST endpoint
        /// responds. Defaults to <see cref="TypeTrafficLight.Off"/>.
        /// </summary>
        public Func<IRenderControlContext, TypeTrafficLight> Value { get; set; }

        /// <summary>
        /// Gets or sets how the lamps are arranged. Defaults to
        /// <see cref="TypeOrientationTrafficLight.Vertical"/>.
        /// </summary>
        public Func<IRenderControlContext, TypeOrientationTrafficLight> Orientation { get; set; }

        /// <summary>
        /// Gets or sets the size of the lamps. Defaults to the compact
        /// <see cref="TypeSizeTrafficLight.Default"/>.
        /// </summary>
        public Func<IRenderControlContext, TypeSizeTrafficLight> Size { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether the surface is read-only. When
        /// <see langword="true"/>, the lamps are rendered for reading only and a
        /// change is neither possible nor persisted.
        /// </summary>
        public Func<IRenderControlContext, bool> Readonly { get; set; }

        /// <summary>
        /// Gets or sets the placeholder tooltip describing what the current state means.
        /// </summary>
        public Func<IRenderControlContext, string> Tooltip { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">Optional host element id.</param>
        public ControlDataTrafficLight(string id = null)
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

            var value = Value?.Invoke(renderContext) ?? TypeTrafficLight.Off;
            var orientation = Orientation?.Invoke(renderContext) ?? TypeOrientationTrafficLight.Vertical;
            var size = Size?.Invoke(renderContext) ?? TypeSizeTrafficLight.Default;
            var readOnly = Readonly?.Invoke(renderContext) ?? false;
            var tooltip = Tooltip?.Invoke(renderContext);

            return new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-traffic-light", size.ToClass(), GetClasses(renderContext)),
                Style = GetStyles(renderContext),
                Role = Role?.Invoke(renderContext)
            }
                .EmitDataIslands(this, renderContext)
                // the off default and the vertical default are implied; only deviations are seeded
                .AddUserAttribute("data-value", value != TypeTrafficLight.Off ? value.ToValue() : null)
                .AddUserAttribute("data-orientation", orientation == TypeOrientationTrafficLight.Horizontal ? orientation.ToValue() : null)
                .AddUserAttribute("data-readonly", readOnly ? "true" : null)
                .AddUserAttribute("data-tooltip", I18N.Translate(renderContext.Request?.Culture, tooltip));
        }
    }
}
