using System;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents a control for composing and editing WQL expressions with REST-based suggestions, 
    /// syntax validation, and history navigation.
    /// </summary>
    public class ControlRestWqlPrompt : Control, IControlRestWqlPrompt
    {
        /// <summary>
        /// Returns or sets the uri that determines the data.
        /// </summary>
        public IUri RestUri { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlRestWqlPrompt(string id = null)
            : base(id ?? Guid.NewGuid().ToString())
        {
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
                Class = Css.Concatenate("wx-webapp-wql-prompt", GetClasses()),
                Style = GetStyles()
            }
            .AddUserAttribute("data-uri", RestUri?.ToString());

            return html;
        }
    }
}