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
        /// Returns or sets the uri that determines the data.
        /// </summary>
        public IUri RestUri { get; set; }

        /// <summary>
        /// Specifies that the table operates in infinite‑scroll mode, where
        /// paging has no predefined endpoint and more data can always be requested.
        /// </summary>
        public bool Infinite { get; set; }

        /// <summary>
        /// Retruns or sets the number of items to display on each page in a 
        /// paginated collection.
        /// </summary>
        public uint PageSize { get; set; }

        /// <summary>
        /// Returns or sets the binding.
        /// </summary>
        public IBinding Bind { get; set; }

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
            return Render(renderContext, visualTree, RestUri);
        }

        /// <summary>
        /// Converts the control to an HTML representation.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <param name="uri">The uri that determines the data.</param>
        /// <returns>An HTML node representing the rendered control.</returns>
        public virtual IHtmlNode Render(IRenderControlContext renderContext, IVisualTreeControl visualTree, IUri uri)
        {
            var resultUri = uri?.BindParameters(renderContext.Request);

            var html = new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-table", GetClasses()),
                Style = GetStyles()
            }
                .AddUserAttribute("data-uri", resultUri?.ToString())
                .AddUserAttribute("data-infinite", Infinite ? "true" : null)
                .AddUserAttribute("data-page-size", PageSize > 0 ? PageSize.ToString() : null);

            Bind?.ApplyUserAttributes(html, Id);

            return new HtmlList(html, Content.Select
            (
                x => x.Render(renderContext, visualTree))
            );
        }
    }
}
