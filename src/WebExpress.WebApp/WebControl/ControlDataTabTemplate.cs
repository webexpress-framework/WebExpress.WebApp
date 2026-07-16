using System;
using System.Collections.Generic;
using System.Linq;
using WebExpress.WebApp.WebSection;
using WebExpress.WebCore;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebIcon;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebFragment;
using WebExpress.WebUI.WebIcon;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents a template for a REST tab control that can be rendered as HTML.
    /// </summary>
    public class ControlDataTabTemplate : IControlDataTabTemplate
    {
        private readonly List<IControl> _content = [];

        /// <summary>
        /// Gets or sets the id.
        /// </summary>
        public string Id { get; set; }

        /// <summary>
        /// Gets or sets the optional declarative binding configuration for template content.
        /// </summary>
        public Func<IRenderControlContext, IBinding> Bind { get; set; }

        /// <summary>
        /// Gets or sets the icon CSS class for the template.
        /// </summary>
        public Func<IRenderControlContext, IIcon> Icon { get; set; }

        /// <summary>
        /// Gets or sets the display name of the template.
        /// </summary>
        public Func<IRenderControlContext, string> Name { get; set; }

        /// <summary>
        /// Gets or sets the description of the template.
        /// </summary>
        public Func<IRenderControlContext, string> Description { get; set; }

        /// <summary>
        /// Gets or sets the optional multiplicity limiting how many tab items
        /// may be instantiated from this template. A null value means unlimited.
        /// </summary>
        public Func<IRenderControlContext, int?> Multiplicity { get; set; }

        /// <summary>
        /// Gets the content of the view control.
        /// </summary>
        public IEnumerable<IControl> Content => _content;

        /// <summary>
        /// Initializes a new instance of the tab template class.
        /// </summary>
        /// <param name="id">The template id.</param>
        public ControlDataTabTemplate(string id = null)
        {
            Id = id;
        }

        /// <summary>
        /// Adds one or more items to the tab control.
        /// </summary>
        /// <param name="items">The items to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlDataTabTemplate Add(params IControl[] items)
        {
            _content.AddRange(items);

            return this;
        }

        /// <summary>
        /// Adds one or more items to the tab control.
        /// </summary>
        /// <param name="items">The items to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlDataTabTemplate Add(IEnumerable<IControl> items)
        {
            _content.AddRange(items);

            return this;
        }

        /// <summary>
        /// Removes the specified control from the tab.
        /// </summary>
        /// <param name="item">The control to remove.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlDataTabTemplate Remove(IControl item)
        {
            _content.Remove(item);

            return this;
        }

        /// <summary>
        /// Converts the template to an HTML representation.
        /// </summary>
        /// <param name="renderContext">The context in which the template is rendered.</param>
        /// <param name="visualTree">The visual tree for the template.</param>
        /// <returns>An HTML node representing the rendered template control.</returns>
        public virtual IHtmlNode Render(IRenderControlContext renderContext, IVisualTreeControl visualTree)
        {
            return Render(renderContext, visualTree, _content);
        }

        /// <summary>
        /// Converts the template to an HTML representation.
        /// </summary>
        /// <param name="renderContext">The context in which the template is rendered.</param>
        /// <param name="visualTree">The visual tree for the template.</param>
        /// <param name="content">The content to render within the template.</param>
        /// <returns>An HTML node representing the rendered template control.</returns>
        public virtual IHtmlNode Render(IRenderControlContext renderContext, IVisualTreeControl visualTree, IEnumerable<IControl> content)
        {
            var bind = Bind?.Invoke(renderContext);
            var icon = Icon?.Invoke(renderContext);
            var name = Name?.Invoke(renderContext);
            var description = Description?.Invoke(renderContext);
            var multiplicity = Multiplicity?.Invoke(renderContext);
            var iconClass = icon is Icon webUiIcon ? webUiIcon.Class : null;
            var fragmentManager = WebEx.ComponentHub.FragmentManager;
            var applicationContext = renderContext?.PageContext?.ApplicationContext;

            // views
            var viewPreferences = fragmentManager.GetFragments<IFragmentControl, SectionTabTemplatePreferences>
            (
                applicationContext,
                [GetType()]
            );
            var viewPrimary = fragmentManager.GetFragments<IFragmentControl, SectionTabTemplatePrimary>
            (
                applicationContext,
                [GetType()]
            );
            var viewSecondary = fragmentManager.GetFragments<IFragmentControl, SectionTabTemplateSecondary>
            (
                applicationContext,
                [GetType()]
            );

            var templateDiv = new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = "wx-template"
            }
                .AddUserAttribute("data-icon", iconClass)
                .AddUserAttribute("data-name", name)
                .AddUserAttribute("data-description", description)
                .AddUserAttribute("data-multiplicity", multiplicity?.ToString(System.Globalization.CultureInfo.InvariantCulture))
                .Add(viewPreferences.Select(x => x.Render(renderContext, visualTree)))
                .Add(content.Select(x => x.Render(renderContext, visualTree)))
                .Add(viewPrimary.Select(x => x.Render(renderContext, visualTree)))
                .Add(viewSecondary.Select(x => x.Render(renderContext, visualTree)));

            bind?.ApplyUserAttributes(templateDiv);

            return templateDiv;
        }
    }

}
