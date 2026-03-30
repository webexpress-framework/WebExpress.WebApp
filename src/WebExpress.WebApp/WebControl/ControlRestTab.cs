using System.Collections.Generic;
using System.Linq;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents a control panel for API tab interactions.
    /// </summary>
    public class ControlRestTab : ControlPanel, IControlRestTab
    {
        private readonly List<IControlRestTabTempate> _templates = [];

        /// <summary>
        /// Returns or sets the uri that determines the data.
        /// </summary>
        public IUri RestUri { get; set; }

        /// <summary>
        /// Returns or sets the binding.
        /// </summary>
        public IBinding Bind { get; set; }

        /// <summary>
        /// Returns the collection of templates associated with the tab.
        /// </summary>
        public IEnumerable<IControlRestTabTempate> Tempates => _templates;

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
        public virtual IControlRestTab Add(params IControlRestTabTempate[] templates)
        {
            _templates.AddRange(templates);

            return this;
        }

        /// <summary>
        /// Adds one or more templates to the tab control.
        /// </summary>
        /// <param name="templates">The templates to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        public virtual IControlRestTab Add(IEnumerable<IControlRestTabTempate> templates)
        {
            _templates.AddRange(templates);

            return this;
        }

        /// <summary>
        /// Removes the specified template from the tab control.
        /// </summary>
        /// <param name="template">The template to remove.</param>
        /// <returns>The current instance for method chaining.</returns>
        public virtual IControlRestTab Remove(IControlRestTabTempate template)
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
            return Render(renderContext, visualTree, RestUri);
        }

        /// <summary>
        /// Converts the control to an HTML representation.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <param name="visualTree">The visual tree.</param>
        /// <param name="uri">An optional URI containing parameters to be bound to the rendering context. Can be null.</param>
        /// <returns>An HTML node representing the rendered control.</returns>
        public virtual IHtmlNode Render(IRenderControlContext renderContext, IVisualTreeControl visualTree, IUri uri)
        {
            var resultUri = uri?.BindParameters(renderContext.Request);

            var html = new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-tab", GetClasses()),
                Style = GetStyles()
            }
                .AddUserAttribute("data-uri", resultUri?.ToString())
                .Add(_templates.Select(x => x.Render(renderContext, visualTree)));

            Bind?.ApplyUserAttributes(html);

            return html;
        }
    }
}