using System;
using System.Linq;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents a control panel for API table interactions.
    /// </summary>
    public class ControlRestTable : ControlPanel, IControlRestTable
    {
        /// <summary>
        /// Gets or sets the uri that determines the data.
        /// </summary>
        public Func<IRenderControlContext, IUri> RestUri { get; set; }

        /// <summary>
        /// Retruns or sets the number of items to display on each page in a 
        /// paginated collection.
        /// </summary>
        public Func<IRenderControlContext, uint> PageSize { get; set; }

        /// <summary>
        /// Gets or sets the binding.
        /// </summary>
        public Func<IRenderControlContext, IBinding> Bind { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlRestTable(string id = null)
            : base(id ?? RandomId.Create())
        {
        }

        /// <summary>
        /// Converts the control to an HTML representation.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <returns>An HTML node representing the rendered control.</returns>
        public override IHtmlNode Render(IRenderControlContext renderContext, IVisualTreeControl visualTree)
        {
            var uri = RestUri?.Invoke(renderContext);
            var pageSize = PageSize?.Invoke(renderContext);
            var bind = Bind?.Invoke(renderContext);
            var resultUri = uri?.BindParameters(renderContext.Request);

            var html = new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-table", GetClasses()),
                Style = GetStyles()
            }
                .AddUserAttribute("data-uri", resultUri?.ToString())
                .AddUserAttribute("data-page-size", pageSize > 0 ? pageSize.ToString() : null);

            bind?.ApplyUserAttributes(html);

            return new HtmlList(html, Content.Select
            (
                x => x.Render(renderContext, visualTree))
            );
        }
    }
}
