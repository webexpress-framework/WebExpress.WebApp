using System;
using System.Collections.Generic;
using WebExpress.WebApp.WebData;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Renders the host element of the permission management surface, which
    /// administers the group-to-policy assignments of a protected resource
    /// (see the identity model: Identity -> Group -> Policy -> Permission).
    /// The surface is a single table: the first column names the group, the
    /// second carries its policies as inline editable chips, the first row
    /// adds a further group and the options menu of a row revokes it.
    ///
    /// The control emits the placeholder div plus the pagination control it
    /// binds through <see cref="BindPaging"/>, so the page count is navigated
    /// by the framework pager rather than by a pager of its own. The table
    /// itself is built by the client-side <c>webexpress.webapp.PermissionCtrl</c>,
    /// which talks to the configured data and policies services.
    /// </summary>
    public class ControlDataPermission : Control, IDataIsland
    {
        /// <summary>
        /// The number of groups per page when the page is silent about it. The
        /// surface is usually hosted in a modal, so it pages earlier than the
        /// full page table does.
        /// </summary>
        private const int DefaultPageSize = 10;

        /// <summary>
        /// Gets the data service descriptors of the control, emitted as
        /// wx-service island elements: the data service backs the assignment
        /// table, the groups service backs the group select of the add row and
        /// the policies service supplies the selectable policy chips.
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
        /// Gets or sets the number of groups shown per page. Defaults to
        /// <see cref="DefaultPageSize"/>.
        /// </summary>
        public Func<IRenderControlContext, int?> PageSize { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether the surface is read-only.
        /// When <see langword="true"/>, the add row, the inline editing of the
        /// policy chips and the options menu are suppressed.
        /// </summary>
        public Func<IRenderControlContext, bool> Readonly { get; set; }

        /// <summary>
        /// Gets or sets an additional binding, for example a search control
        /// bound through <see cref="BindSearch"/>. The paging bind that
        /// connects the emitted pagination control is always added on top.
        /// </summary>
        public Func<IRenderControlContext, IBinding> Bind { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">Optional host element id.</param>
        public ControlDataPermission(string id = null)
            : base(id ?? RandomId.Create())
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

            var pageSize = PageSize?.Invoke(renderContext) ?? DefaultPageSize;
            var readOnly = Readonly?.Invoke(renderContext) ?? false;
            var pagerId = $"{Id}_pager";

            var host = new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-permission", GetClasses(renderContext)),
                Style = GetStyles(renderContext),
                Role = Role?.Invoke(renderContext)
            }
                .EmitDataIslands(this, renderContext)
                .AddUserAttribute("data-page-size", pageSize.ToString())
                .AddUserAttribute("data-readonly", readOnly ? "true" : null);

            var binding = Bind?.Invoke(renderContext) ?? new Binding();
            binding.Add(new BindPaging { Source = pagerId }).ApplyUserAttributes(host);

            var pager = new ControlPagination(pagerId);

            return new HtmlList(host, pager.Render(renderContext, visualTree));
        }
    }
}
