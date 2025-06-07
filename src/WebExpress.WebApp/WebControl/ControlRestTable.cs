using System;
using System.Collections.Generic;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents a control panel for API table interactions.
    /// </summary>
    public class ControlRestTable : ControlPanel, IControlRest
    {
        /// <summary>
        /// Returns or sets the uri that determines the data.
        /// </summary>
        public IUri RestUri { get; set; }

        /// <summary>
        /// Returns or sets the settings for the editing options (e.g. Edit, Delete, ...).
        /// </summary>
        public ControlRestTableOption OptionSettings { get; private set; } = new ControlRestTableOption();

        /// <summary>
        /// Returns or sets the editing options (e.g. Edit, Delete, ...).
        /// </summary>
        public ICollection<ControlRestTableOptionItem> OptionItems { get; private set; } = new List<ControlRestTableOptionItem>();

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlRestTable(string id = null)
            : base(id ?? Guid.NewGuid().ToString())
        {
        }

        /// <summary>
        /// Converts the control to an HTML representation.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <returns>An HTML node representing the rendered control.</returns>
        public override IHtmlNode Render(IRenderControlContext renderContext, IVisualTreeControl visualTree)
        {
            var html = new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-table", GetClasses()),
                Style = GetStyles()
            }
            .AddUserAttribute("data-uri", RestUri?.ToString());

            return html;
        }
    }
}
