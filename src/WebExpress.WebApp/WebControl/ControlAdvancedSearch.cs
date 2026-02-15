using System.Collections.Generic;
using System.Linq;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents a combined search control that integrates a basic search 
    /// input and an advanced WQL prompt into a single, user-toggleable 
    /// component. The control listens for webexpress.webui.Event.CHANGE_FILTER_EVENT from the
    /// basic search and webexpress.webapp.Event.WQL_FILTER_EVENT from the WQL
    /// prompt, normalizes their payloads and re-emits a unified
    /// webexpress.webui.Event.CHANGE_FILTER_EVENT.
    /// </summary>
    public class ControlAdvancedSearch : Control, IControlSearch
    {
        private readonly List<IControl> _content = [];

        /// <summary>
        /// Returns or sets the uri that determines the data.
        /// </summary>
        public IUri RestUri { get; set; }

        /// <summary>
        /// Returns the content of the control (e.g., save button).
        /// </summary>
        public IEnumerable<IControl> Content => _content;

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlAdvancedSearch(string id = null)
            : base(id ?? RandomId.Create())
        {
        }

        /// <summary>
        /// Adds one or more controls to the search control.
        /// </summary>
        /// <param name="controls">The items to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlSearch Add(params IControl[] controls)
        {
            _content.AddRange(controls);

            return this;
        }

        /// <summary>
        /// Adds one or more controls to the search control.
        /// </summary>
        /// <param name="controls">The controls to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlSearch Add(IEnumerable<IControl> controls)
        {
            _content.AddRange(controls);

            return this;
        }

        /// <summary>
        /// Removes the specified control from the view control.
        /// </summary>
        /// <param name="control">The control to remove.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlSearch Remove(IControl control)
        {
            _content.Remove(control);

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
            var html = new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-search", GetClasses()),
                Style = GetStyles()
            }
                .Add(_content.Select(x => x.Render(renderContext, visualTree)));

            return html;
        }
    }
}