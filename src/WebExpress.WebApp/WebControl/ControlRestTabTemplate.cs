using System.Collections.Generic;
using System.Linq;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents a template for a REST tab control that can be rendered as HTML.
    /// </summary>
    public class ControlRestTabTemplate : IControlRestTabTemplate
    {
        private readonly List<IControl> _content = [];

        /// <summary>
        /// Gets or sets the template id.
        /// </summary>
        public string Id { get; set; }

        /// <summary>
        /// Gets the content of the view control.
        /// </summary>
        public IEnumerable<IControl> Content => _content;

        /// <summary>
        /// Initializes a new instance of the tab template class.
        /// </summary>
        /// <param name="id">The template id.</param>
        public ControlRestTabTemplate(string id = null)
        {
            Id = id;
        }

        /// <summary>
        /// Adds one or more items to the tab control.
        /// </summary>
        /// <param name="items">The items to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlRestTabTemplate Add(params IControl[] items)
        {
            _content.AddRange(items);

            return this;
        }

        /// <summary>
        /// Adds one or more items to the tab control.
        /// </summary>
        /// <param name="items">The items to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlRestTabTemplate Add(IEnumerable<IControl> items)
        {
            _content.AddRange(items);

            return this;
        }

        /// <summary>
        /// Removes the specified control from the tab.
        /// </summary>
        /// <param name="item">The control to remove.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlRestTabTemplate Remove(IControl item)
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
            var templateDiv = new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = "wx-template"
            }
                .Add(_content.Select(x => x.Render(renderContext, visualTree)));

            return templateDiv;
        }
    }

}
