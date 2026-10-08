using System;
using System.Collections.Generic;
using System.Linq;
using WebExpress.WebApp.WebData;
using WebExpress.WebApp.WebSection;
using WebExpress.WebCore;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebScope;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebFragment;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Renders the host element of the permission management surface, which
    /// administers the group-to-policy assignments of a protected resource
    /// (see the identity model: Identity -> Group -> Policy -> Permission).
    /// The surface is a single table: the first column names the group, the
    /// second carries its policies as inline editable chips and the options
    /// menu of a row revokes it. Further groups are assigned through the dialog
    /// the toolbar above the table opens - one dialog assigns the same policy
    /// set to every picked group - so the table itself shows stored assignments
    /// only.
    ///
    /// The toolbar above the table starts with the optional <see cref="Title"/>
    /// and the tools a plugin contributes through the sections
    /// <see cref="SectionPermissionToolbarPreferences"/>,
    /// <see cref="SectionPermissionToolbarPrimary"/> and
    /// <see cref="SectionPermissionToolbarSecondary"/>, and ends with the assign
    /// affordance the client adds. The sections resolve against the runtime type
    /// of the control, so a fragment scoped to <see cref="ControlDataPermission"/>
    /// joins every permission surface and a fragment scoped to a subclass joins
    /// that one alone.
    ///
    /// The control emits the placeholder div plus the pagination control it
    /// binds through <see cref="BindPaging"/>, so the page count is navigated
    /// by the framework pager rather than by a pager of its own. The table
    /// itself is built by the client-side <c>webexpress.webapp.PermissionCtrl</c>,
    /// which talks to the configured data and policies services.
    /// </summary>
    public class ControlDataPermission : Control, IDataIsland, IScope
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
        /// table, the groups service backs the group picker of the assign dialog
        /// and the policies service supplies the selectable policy chips.
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
        /// Gets or sets the optional caption at the start of the toolbar above
        /// the table. It names what the assignments protect when the surrounding
        /// page does not; hosted in a modal the dialog header usually does, which
        /// is why the caption is optional. The value is translated, so an i18n key
        /// may be passed.
        /// </summary>
        public Func<IRenderControlContext, string> Title { get; set; }

        /// <summary>
        /// Gets or sets the number of groups shown per page. Defaults to
        /// <see cref="DefaultPageSize"/>.
        /// </summary>
        public Func<IRenderControlContext, int?> PageSize { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether the surface is read-only.
        /// When <see langword="true"/>, the assign affordance, the inline editing
        /// of the policy chips and the options menu are suppressed. The title and
        /// the contributed tools stay, because reading the assignments is what
        /// they help with as well.
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
            var title = Title?.Invoke(renderContext);
            var pagerId = $"{Id}_pager";
            var tools = GetTools(renderContext).ToList();

            var host = new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-permission", GetClasses(renderContext)),
                Style = GetStyles(renderContext),
                Role = Role?.Invoke(renderContext)
            };

            // the tools are rendered on the server, because a fragment may be any
            // control of the framework; the client lifts the container into its
            // toolbar before the table takes over the host
            var rendered = tools
                .Select(x => x.Render(renderContext, visualTree))
                .Where(x => x != null)
                .ToArray();

            if (rendered.Length > 0)
            {
                host.Add(new HtmlElementTextContentDiv(rendered)
                {
                    Class = "wx-permission-tools"
                });
            }

            host.EmitDataIslands(this, renderContext)
                .AddUserAttribute("data-page-size", pageSize.ToString())
                .AddUserAttribute("data-readonly", readOnly ? "true" : null)
                .AddUserAttribute("data-title", !string.IsNullOrWhiteSpace(title) ? I18N.Translate(renderContext, title) : null);

            var binding = Bind?.Invoke(renderContext) ?? new Binding();

            // a search box among the tools searches this surface, so it is bound
            // here rather than by the page, which does not know the id a fragment
            // renders with; an authored search bind keeps precedence
            var search = tools.OfType<IFragmentControlSearch>().FirstOrDefault();
            if (search != null && !binding.Binds.OfType<IBindSearch>().Any())
            {
                binding.Add(new BindSearch { Source = search.Id });
            }

            binding.Add(new BindPaging { Source = pagerId }).ApplyUserAttributes(host);

            var pager = new ControlPagination(pagerId);

            return new HtmlList(host, pager.Render(renderContext, visualTree));
        }

        /// <summary>
        /// Collects the tools a plugin contributed to the toolbar, in the order
        /// of the three sections. The sections resolve against the runtime type
        /// of the control, so a subclass is what aims a fragment at one
        /// particular surface.
        /// </summary>
        /// <param name="renderContext">The render context.</param>
        /// <returns>The contributed tool controls.</returns>
        private IEnumerable<IFragmentControl> GetTools(IRenderControlContext renderContext)
        {
            var fragmentManager = WebEx.ComponentHub.FragmentManager;
            var applicationContext = renderContext?.PageContext?.ApplicationContext;

            return fragmentManager.GetFragments<IFragmentControl, SectionPermissionToolbarPreferences>(applicationContext, [GetType()])
                .Concat(fragmentManager.GetFragments<IFragmentControl, SectionPermissionToolbarPrimary>(applicationContext, [GetType()]))
                .Concat(fragmentManager.GetFragments<IFragmentControl, SectionPermissionToolbarSecondary>(applicationContext, [GetType()]));
        }
    }
}
