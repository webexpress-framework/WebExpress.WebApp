using System;
using System.Collections.Generic;
using System.Linq;
using WebExpress.WebApp.WebFragment;
using WebExpress.WebApp.WebSection;
using WebExpress.WebCore;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;
using WebExpress.WebUI.WebSection;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents a control panel for API tab interactions.
    /// </summary>
    public class ControlRestTab : ControlPanel, IControlRestTab
    {
        private readonly List<IControlRestTabTemplate> _templates = [];

        /// <summary>
        /// Gets or sets the uri that determines the data.
        /// </summary>
        public Func<IRenderControlContext, IUri> RestUri { get; set; }

        /// <summary>
        /// Gets or sets the binding.
        /// </summary>
        public Func<IRenderControlContext, IBinding> Bind { get; set; }

        /// <summary>
        /// Gets the collection of templates associated with the tab.
        /// </summary>
        public IEnumerable<IControlRestTabTemplate> Templates => _templates;

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
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlRestTab(string id = null)
            : base(id ?? RandomId.Create())
        {
        }

        /// <summary>
        /// Adds one or more templates to the tab control.
        /// </summary>
        /// <param name="templates">The templates to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        public virtual IControlRestTab Add(params IControlRestTabTemplate[] templates)
        {
            _templates.AddRange(templates);

            return this;
        }

        /// <summary>
        /// Adds one or more templates to the tab control.
        /// </summary>
        /// <param name="templates">The templates to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        public virtual IControlRestTab Add(IEnumerable<IControlRestTabTemplate> templates)
        {
            _templates.AddRange(templates);

            return this;
        }

        /// <summary>
        /// Removes the specified template from the tab control.
        /// </summary>
        /// <param name="template">The template to remove.</param>
        /// <returns>The current instance for method chaining.</returns>
        public virtual IControlRestTab Remove(IControlRestTabTemplate template)
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
            var uri = RestUri?.Invoke(renderContext);
            var bind = Bind?.Invoke(renderContext);
            var resultUri = uri?.BindParameters(renderContext.Request);
            var @readonly = Readonly?.Invoke(renderContext) ?? false;
            var movableTab = MovableTab?.Invoke(renderContext) ?? false;
            var fragmentManager = WebEx.ComponentHub.FragmentManager;
            var applicationContext = renderContext?.PageContext?.ApplicationContext;

            // templates
            var templatePreferences = fragmentManager.GetFragments<IFragmentControlRestTabTemplate, SectionTabTemplatePreferences>
            (
                applicationContext,
                [GetType()]
            );
            var templatePrimary = fragmentManager.GetFragments<IFragmentControlRestTabTemplate, SectionViewItemPrimary>
            (
                applicationContext,
                [GetType()]
            );
            var templateSecondary = fragmentManager.GetFragments<IFragmentControlRestTabTemplate, SectionViewItemSecondary>
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
                .AddUserAttribute("data-uri", resultUri?.ToString())
                .AddUserAttribute("data-readonly", @readonly ? "true" : null)
                .AddUserAttribute("data-movable-tab", movableTab ? "true" : null)
                .Add(templatePreferences.Select(x => x.Render(renderContext, visualTree)))
                .Add(templatePrimary.Select(x => x.Render(renderContext, visualTree)))
                .Add(_templates.Select(x => x.Render(renderContext, visualTree)))
                .Add(templateSecondary.Select(x => x.Render(renderContext, visualTree)));

            bind?.ApplyUserAttributes(html);

            return html;
        }
    }
}
