using System;
using System.Net;
using WebExpress.WebApp.WebData;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents a control panel for API tile interactions.
    /// </summary>
    public class ControlDataTile : ControlPanel, IControlDataTile, IDataIsland
    {
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
        /// Gets or sets the optional data service descriptor. When set, the
        /// control emits a data-wx-service island the JavaScript engine consumes
        /// in preference to the legacy data-uri fallback. See
        /// WebExpress/docs/view-state-service.md.
        /// </summary>
        public Func<IRenderControlContext, DataServiceDescriptor> ServiceFactory { get; set; }

        /// <summary>
        /// Gets or sets the optional initial state, emitted as the data-wx-state island.
        /// </summary>
        public Func<IRenderControlContext, DataState> StateFactory { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlDataTile(string id = null)
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
            var pageSize = PageSize?.Invoke(renderContext) ?? 0;
            var bind = Bind?.Invoke(renderContext);

            var html = new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-tile", GetClasses(renderContext)),
                Style = GetStyles(renderContext)
            }
                .AddUserAttribute("data-page-size", pageSize > 0 ? pageSize.ToString() : null)
                .EmitDataIslands(this, renderContext);

            bind?.ApplyUserAttributes(html);

            return html;
        }
    }
}