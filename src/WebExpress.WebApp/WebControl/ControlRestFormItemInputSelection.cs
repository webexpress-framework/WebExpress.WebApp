using System;
using WebExpress.WebApp.WebControl;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebApiControl
{
    /// <summary>
    /// Represents a form item input selection that retrieves options from a specified URI.
    /// </summary>
    public class ControlRestFormItemInputSelection : ControlFormItemInputSelection, IControlRest
    {
        /// <summary>
        /// Gets or sets the uri that determines the options.
        /// </summary>
        public Func<IRenderControlContext, IUri> RestUri { get; set; }

        /// <summary>
        /// Gets or sets the binding.
        /// </summary>
        public new Func<IRenderControlContext, IBinding> Bind { get; set; }

        /// <summary>
        /// Gets or sets the maximum number of entries to display (default 25).
        /// </summary>
        public Func<IRenderControlContext, int> MaxItems { get; set; } = _ => -1;

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
            var restUri = RestUri?.Invoke(renderContext);
            var maxItems = MaxItems?.Invoke(renderContext) ?? -1;
            var bind = Bind?.Invoke(renderContext);

            var html = base.Render(renderContext, visualTree)
                .AddClass("wx-webapp-input-selection")
                .RemoveClass("wx-webui-input-selection")
                .AddUserAttribute("data-uri", restUri?.ToString())
                .AddUserAttribute("data-maxItems", maxItems > 0 ? maxItems.ToString() : null);

            bind?.ApplyUserAttributes(html);

            return html;
        }
    }
}
