using System;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebIcon;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebIcon;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// A quick-filter dropdown whose options are loaded from a REST endpoint
    /// rather than authored statically. The client fetches the option list
    /// through the service layer and registers each one as a filter, so the menu
    /// reflects server-side data such as the current set of labels, owners or
    /// states. Setting <see cref="Multiple"/> turns it into a multi-select.
    /// </summary>
    public class ControlDataQuickfilterItemDropdown : IControlQuickfilterItem
    {
        /// <summary>
        /// Gets the id of the control.
        /// </summary>
        public string Id { get; private set; }

        /// <summary>
        /// Gets or sets the toggle text.
        /// </summary>
        public Func<IRenderControlContext, string> Text { get; set; }

        /// <summary>
        /// Gets or sets the toggle icon.
        /// </summary>
        public Func<IRenderControlContext, IIcon> Icon { get; set; }

        /// <summary>
        /// Gets or sets the REST endpoint returning the option list, an array of
        /// <c>{ id, name, group?, exclusive?, icon? }</c> objects.
        /// </summary>
        public Func<IRenderControlContext, IUri> Uri { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether several options may be active at
        /// once, rendering the dropdown as a multi-select.
        /// </summary>
        public Func<IRenderControlContext, bool> Multiple { get; set; }

        /// <summary>
        /// Gets or sets the filter group shared by the loaded options. A
        /// single-choice dropdown is exclusive within this group, so picking an
        /// option clears the previous one. When not set, the control id is used.
        /// </summary>
        public Func<IRenderControlContext, string> Group { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The id of the control.</param>
        public ControlDataQuickfilterItemDropdown(string id = null)
        {
            Id = id;
        }

        /// <summary>
        /// Converts the control to an HTML representation.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <param name="visualTree">The visual tree representing the control's structure.</param>
        /// <returns>An HTML node representing the rendered control.</returns>
        public virtual IHtmlNode Render(IRenderControlContext renderContext, IVisualTreeControl visualTree)
        {
            var text = I18N.Translate(renderContext, Text?.Invoke(renderContext));
            var icon = Icon?.Invoke(renderContext);
            var uri = Uri?.Invoke(renderContext);
            var multiple = Multiple?.Invoke(renderContext) ?? false;
            var group = Group?.Invoke(renderContext);

            return new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = Css.Concatenate(multiple ? "wx-quickfilter-multiselect" : "wx-quickfilter-dropdown")
            }
                .AddUserAttribute("data-text", text)
                .AddUserAttribute("data-icon", (icon as Icon)?.Class)
                .AddUserAttribute("data-group", group)
                .AddUserAttribute("data-rest-uri", uri?.ToString());
        }
    }
}
