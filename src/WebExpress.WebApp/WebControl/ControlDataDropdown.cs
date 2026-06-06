using System;
using WebExpress.WebApp.WebControl;
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
    public class ControlDataDropdown : ControlDropdown, IControlData
    {
        /// <summary>
        /// Gets or sets the REST API endpoint used to populate the dropdown.
        /// </summary>
        public Func<IRenderControlContext, IUri> RestUri { get; set; }

        /// <summary>
        /// Gets or sets the maximum number of entries to display (default 25).
        /// </summary>
        public Func<IRenderControlContext, int> MaxItems { get; set; } = _ => -1;

        /// <summary>
        /// Gets or sets the placeholder text for the search input.
        /// </summary>
        public Func<IRenderControlContext, string> SearchPlaceholder { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlDataDropdown(string id = null)
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
            var restUri = RestUri?.Invoke(renderContext);
            var maxItems = MaxItems?.Invoke(renderContext) ?? -1;
            var searchPlaceholder = SearchPlaceholder?.Invoke(renderContext);

            // create host element for the remote dropdown controller
            var html = base.Render(renderContext, visualTree)
                .AddClass("wx-webapp-dropdown")
                .RemoveClass("wx-webui-dropdown")
                .AddUserAttribute("data-uri", restUri?.ToString())
                .AddUserAttribute("data-maxItems", maxItems > 0 ? maxItems.ToString() : null)
                .AddUserAttribute("data-searchPlaceholder", I18N.Translate(renderContext, searchPlaceholder));

            return html;
        }
    }
}