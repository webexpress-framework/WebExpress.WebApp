using System;
using System.Collections.Generic;
using System.Linq;
using WebExpress.WebApp.WebData;
using WebExpress.WebApp.WebFragment;
using WebExpress.WebCore;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;
using WebExpress.WebUI.WebSection;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents a control panel for API tab interactions.
    /// </summary>
    public class ControlDataTab : ControlPanel, IControlDataTab, IDataIsland, IViewStateBound
    {
        private readonly List<IControlDataTabTemplate> _templates = [];

        /// <summary>
        /// Gets or sets the name of the enclosing ViewState resource the tabs render.
        /// When set, the control is a pure view of a central resource the
        /// ViewState owns; when null, it owns its state and service islands and
        /// loads itself.
        /// </summary>
        public Func<IRenderControlContext, string> ResourceFactory { get; set; }

        /// <summary>
        /// Gets or sets the optional ViewState id the control binds to. When null, it
        /// resolves the nearest enclosing ViewState by ancestry.
        /// </summary>
        public Func<IRenderControlContext, string> ViewState { get; set; }

        /// <summary>
        /// Gets or sets the binding.
        /// </summary>
        public Func<IRenderControlContext, IBinding> Bind { get; set; }

        /// <summary>
        /// Gets the collection of templates associated with the tab.
        /// </summary>
        public IEnumerable<IControlDataTabTemplate> Templates => _templates;

        /// <summary>
        /// Gets or sets a value indicating whether the control is read-only.
        /// </summary>
        public Func<IRenderControlContext, bool> Readonly { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether the tabs can be reordered via
        /// drag and drop. When <see langword="true"/>, each tab header gets a ⠿
        /// grip handle and the new order is persisted to the REST endpoint via a
        /// <c>PUT</c> carrying the ordered tab ids.
        /// </summary>
        public Func<IRenderControlContext, bool> MovableTab { get; set; }

        /// <summary>
        /// Gets the data service descriptors of the control, emitted together as
        /// the data-wx-service island that the JavaScript engine consumes in
        /// preference to the legacy data-uri fallback, which keeps the endpoint
        /// and parameter knowledge authored in C#. When empty, the control
        /// behaves exactly as before and the client uses its legacy descriptor.
        /// See WebExpress/docs/view-state-service.md.
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
        /// data-wx-template attribute that the client Templates registry
        /// resolves into a registered view.
        /// </summary>
        public Func<IRenderControlContext, string> TemplateFactory { get; set; }

        /// <summary>
        /// Gets or sets the optional initial state, emitted as the data-wx-state island.
        /// </summary>
        public Func<IRenderControlContext, DataState> StateFactory { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlDataTab(string id = null)
            : base(id ?? RandomId.Create())
        {
        }

        /// <summary>
        /// Adds one or more templates to the tab control.
        /// </summary>
        /// <param name="templates">The templates to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        public virtual IControlDataTab Add(params IControlDataTabTemplate[] templates)
        {
            _templates.AddRange(templates);

            return this;
        }

        /// <summary>
        /// Adds one or more templates to the tab control.
        /// </summary>
        /// <param name="templates">The templates to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        public virtual IControlDataTab Add(IEnumerable<IControlDataTabTemplate> templates)
        {
            _templates.AddRange(templates);

            return this;
        }

        /// <summary>
        /// Removes the specified template from the tab control.
        /// </summary>
        /// <param name="template">The template to remove.</param>
        /// <returns>The current instance for method chaining.</returns>
        public virtual IControlDataTab Remove(IControlDataTabTemplate template)
        {
            _templates.Remove(template);

            return this;
        }

        /// <summary>
        /// Converts the control to an HTML representation.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <param name="visualTree">The visual tree.</param>
        /// <returns>An HTML node representing the rendered control.</returns>
        public override IHtmlNode Render(IRenderControlContext renderContext, IVisualTreeControl visualTree)
        {
            var bind = Bind?.Invoke(renderContext);
            var @readonly = Readonly?.Invoke(renderContext) ?? false;
            var movableTab = MovableTab?.Invoke(renderContext) ?? false;
            var fragmentManager = WebEx.ComponentHub.FragmentManager;
            var applicationContext = renderContext?.PageContext?.ApplicationContext;

            // templates
            var templatePreferences = fragmentManager.GetFragments<IFragmentControlDataTabTemplate, SectionTabViewPreferences>
            (
                applicationContext,
                [GetType()]
            );
            var templatePrimary = fragmentManager.GetFragments<IFragmentControlDataTabTemplate, SectionTabViewPrimary>
            (
                applicationContext,
                [GetType()]
            );
            var templateSecondary = fragmentManager.GetFragments<IFragmentControlDataTabTemplate, SectionTabViewSecondary>
            (
                applicationContext,
                [GetType()]
            );

            var html = new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-tab", GetClasses(renderContext)),
                Style = GetStyles(renderContext)
            }
                .AddUserAttribute("data-readonly", @readonly ? "true" : null)
                .AddUserAttribute("data-movable-tab", movableTab ? "true" : null)
                .Add(templatePreferences.Select(x => x.Render(renderContext, visualTree)))
                .Add(templatePrimary.Select(x => x.Render(renderContext, visualTree)))
                .Add(_templates.Select(x => x.Render(renderContext, visualTree)))
                .Add(templateSecondary.Select(x => x.Render(renderContext, visualTree)));

            html.EmitDataIslands(this, renderContext);

            bind?.ApplyUserAttributes(html);

            return html;
        }
    }
}
