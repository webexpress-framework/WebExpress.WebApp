using System;
using System.Collections.Generic;
using WebExpress.WebApp.WebData;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Renders the host element for the permission management surface, which
    /// administers the group-to-policy assignments of a protected resource
    /// (see the identity model: Identity -> Group -> Policy -> Permission).
    /// The control only emits the placeholder div; the assign row, the
    /// searchable assignment table and the pager are built by the client-side
    /// <c>webexpress.webapp.PermissionCtrl</c>, which talks to the configured
    /// data, groups and policies services.
    /// </summary>
    public class ControlDataPermission : Control, IDataIsland
    {
        /// <summary>
        /// Gets the data service descriptors of the control, emitted as
        /// wx-service island elements: the data service backs the assignment
        /// table, the groups and policies services back the assign selects.
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
        /// Gets or sets the number of assignments shown per page. Defaults to
        /// <c>10</c> on the client side when not provided.
        /// </summary>
        public Func<IRenderControlContext, int?> PageSize { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether the surface is read-only.
        /// When <see langword="true"/>, the assign row and the per-row remove
        /// affordance are suppressed.
        /// </summary>
        public Func<IRenderControlContext, bool> Readonly { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">Optional host element id.</param>
        public ControlDataPermission(string id = null)
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

            var pageSize = PageSize?.Invoke(renderContext);
            var readOnly = Readonly?.Invoke(renderContext) ?? false;

            return new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-permission", GetClasses(renderContext)),
                Style = GetStyles(renderContext),
                Role = Role?.Invoke(renderContext)
            }
                .EmitDataIslands(this, renderContext)
                .AddUserAttribute("data-page-size", pageSize?.ToString())
                .AddUserAttribute("data-readonly", readOnly ? "true" : null);
        }
    }
}
