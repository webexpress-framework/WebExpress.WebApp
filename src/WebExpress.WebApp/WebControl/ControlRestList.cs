using System;
using System.Linq;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents a control panel for API list interactions.
    /// </summary>
    public class ControlRestList : ControlList, IControlRestList
    {
        /// <summary>
        /// Gets or sets the uri that determines the data.
        /// </summary>
        public Func<IRenderControlContext, IUri> RestUri { get; set; }

        /// <summary>
        /// Gets or sets the binding.
        /// </summary>
        public Func<IRenderControlContext, IBinding> Bind { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlRestList(string id = null)
            : base(id ?? RandomId.Create())
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
            var uri = RestUri?.Invoke(renderContext);
            var resultUri = uri?.BindParameters(renderContext.Request);
            var selectable = Selectable?.Invoke(renderContext) ?? false;
            var title = Title?.Invoke(renderContext);
            var sortable = Sortable?.Invoke(renderContext) ?? false;
            var layout = Layout?.Invoke(renderContext);
            var bind = Bind?.Invoke(renderContext);

            var html = new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-list", GetClasses()),
                Style = GetStyles()
            }
                .AddUserAttribute("data-title", I18N.Translate(renderContext, title))
                .AddUserAttribute("data-sortable", sortable ? "true" : null)
                .AddUserAttribute("data-selectable", selectable ? "true" : null)
                .AddUserAttribute("data-layout", layout?.ToClass())
                .AddUserAttribute("data-uri", resultUri?.ToString())
                .Add(Items.Select(x => x.Render(renderContext, visualTree)));

            bind?.ApplyUserAttributes(html);

            return html;
        }
    }
}