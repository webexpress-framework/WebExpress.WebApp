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
    /// Renders the host element for a REST-backed tag (label) surface. The
    /// control only emits the placeholder div; the actual chips, remove
    /// buttons, input field and autocomplete dropdown are built by the
    /// client-side <c>webexpress.webapp.TagCtrl</c>, which extends the WebUI
    /// <c>webexpress.webui.InputTagCtrl</c> and talks to the configured REST
    /// endpoint to load, add and delete tags. Autocomplete suggestions are
    /// served by the same endpoint via the <c>q</c> query parameter.
    /// </summary>
    public class ControlDataTag : Control, IControlData, IDataIsland
    {
        /// <summary>
        /// Gets the data service descriptors of the control, emitted as
        /// wx-service island elements. The data service backs the load, the
        /// autocomplete, the add and the remove of the tag surface.
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
        /// Gets or sets a value indicating whether the surface is read-only.
        /// When <see langword="true"/>, the input field and the per-chip
        /// remove buttons are suppressed and the tags are rendered for
        /// reading only.
        /// </summary>
        public Func<IRenderControlContext, bool> Readonly { get; set; }

        /// <summary>
        /// Gets or sets the placeholder text shown in the input field while no
        /// tags are present.
        /// </summary>
        public Func<IRenderControlContext, string> Placeholder { get; set; }

        /// <summary>
        /// Gets or sets the color of the tags.
        /// </summary>
        public Func<IRenderControlContext, PropertyColorTag> Color { get; set; }

        /// <summary>
        /// Gets or sets the initial set of tags rendered server-side to avoid a
        /// flash before the REST endpoint responds. The values are joined with
        /// a semicolon into the <c>data-value</c> attribute.
        /// </summary>
        public Func<IRenderControlContext, IEnumerable<string>> Value { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">Optional host element id.</param>
        public ControlDataTag(string id = null)
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

            var readOnly = Readonly?.Invoke(renderContext) ?? false;
            var placeholder = Placeholder?.Invoke(renderContext);
            var color = Color?.Invoke(renderContext);
            var value = Value?.Invoke(renderContext);
            var dataValue = value != null
                ? string.Join(";", value.Where(x => !string.IsNullOrWhiteSpace(x)))
                : null;

            return new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-tag", GetClasses(renderContext)),
                Style = GetStyles(renderContext),
                Role = Role?.Invoke(renderContext)
            }
                .EmitDataIslands(this, renderContext)
                .AddUserAttribute("placeholder", I18N.Translate(renderContext.Request?.Culture, placeholder))
                .AddUserAttribute("data-value", string.IsNullOrEmpty(dataValue) ? null : dataValue)
                .AddUserAttribute("data-readonly", readOnly ? "true" : null)
                .AddUserAttribute("data-color-css", color?.ToClass())
                .AddUserAttribute("data-color-style", color?.ToStyle());
        }
    }
}
