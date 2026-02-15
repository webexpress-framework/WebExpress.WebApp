using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebApiControl
{
    /// <summary>
    /// Represents a form item input selection that retrieves options from a specified URI.
    /// </summary>
    public class ControlRestFormItemInputSelection : ControlFormItemInputSelection
    {
        /// <summary>
        /// Returns or sets the uri that determines the options.
        /// </summary>
        public IUri RestUri { get; set; }

        /// <summary>
        /// Returns or sets the maximum number of entries to display (default 25).
        /// </summary>
        public int MaxItems { get; set; } = -1;

        /// <summary>
        /// Initializes a new instance of the class with an automatically assigned ID.
        /// </summary>
        public ControlRestFormItemInputSelection()
            : this(DeterministicId.Create())
        {
        }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        /// <param name="items">The entries.</param>
        public ControlRestFormItemInputSelection(string id, params ControlFormItemInputSelectionItem[] items)
            : base(id, items)
        {
        }

        /// <summary>
        /// Converts the control to an HTML representation.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <param name="visualTree">The visual tree representing the control's structure.</param>
        /// <returns>An HTML node representing the rendered control.</returns>
        public override IHtmlNode Render(IRenderControlFormContext renderContext, IVisualTreeControl visualTree)
        {
            var html = base.Render(renderContext, visualTree)
                .AddClass("wx-webapp-input-selection")
                .RemoveClass("wx-webui-input-selection")
                .AddUserAttribute("data-uri", RestUri?.ToString())
                .AddUserAttribute("data-maxItems", MaxItems > 0 ? MaxItems.ToString() : null);

            return html;
        }
    }
}
