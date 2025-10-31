using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebApiControl
{
    /// <summary>
    /// Represents a dropdown control that can be rendered as HTML within a RESTful web application context.
    /// </summary>
    public class ControlRestDropdown : ControlDropdown
    {
        /// <summary>
        /// Returns or sets the REST API endpoint used to populate the dropdown.
        /// </summary>
        public IUri RestUri { get; set; }

        /// <summary>
        /// Returns or sets the maximum number of entries to display (default 25).
        /// </summary>
        public int MaxItems { get; set; } = -1;

        /// <summary>
        /// Returns or sets the placeholder text for the search input.
        /// </summary>
        public string SearchPlaceholder { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlRestDropdown(string id = null)
            : base(id)
        {
        }

        /// <summary>
        /// Converts the control to an HTML representation.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <param name="visualTree">The visual tree representing the control's structure.</param>
        /// <returns>An HTML node representing the rendered control.</returns>
        public override IHtmlNode Render(IRenderControlContext renderContext, IVisualTreeControl visualTree)
        {
            // create host element for the remote dropdown controller
            var html = base.Render(renderContext, visualTree)
                .AddClass("wx-webapp-dropdown")
                .RemoveClass("wx-webui-dropdown")
                .AddUserAttribute("data-uri", RestUri?.ToString())
                .AddUserAttribute("data-maxItems", MaxItems > 0 ? MaxItems.ToString() : null)
                .AddUserAttribute("data-searchPlaceholder", I18N.Translate(renderContext, SearchPlaceholder));

            return html;
        }
    }
}