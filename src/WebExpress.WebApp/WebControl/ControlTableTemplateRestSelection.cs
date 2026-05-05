using System;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents a control that renders a rest selection in a table using a template.
    /// </summary>
    public class ControlTableTemplateRestSelection : IControlTableTemplateEditable
    {
        /// <summary>
        /// Gets or sets the unique identifier for the object.
        /// </summary>
        public string Id { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether the current template is editable or read-only.
        /// </summary>
        public Func<IRenderControlContext, bool> Editable { get; set; }

        /// <summary>
        /// Allows you to select multiple items.
        /// </summary>
        public Func<IRenderControlContext, bool> MultiSelect { get; set; }

        /// <summary>
        /// Gets or sets the placeholder text displayed when the input field is empty.
        /// </summary>
        public Func<IRenderControlContext, string> Placeholder { get; set; }

        /// <summary>
        /// Gets or sets the uri that determines the data.
        /// </summary>
        public Func<IRenderControlContext, IUri> RestUri { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The id of the control.</param>
        public ControlTableTemplateRestSelection(string id = null)
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
            var multiSelect = MultiSelect?.Invoke(renderContext) ?? false;
            var placeholder = Placeholder?.Invoke(renderContext);
            var editable = Editable?.Invoke(renderContext) ?? false;
            var restUri = RestUri?.Invoke(renderContext);

            var html = new HtmlElement("template")
            {
                Id = Id
            }
                .AddUserAttribute("data-type", "rest_selection")
                .AddUserAttribute("data-multiselection", multiSelect ? "true" : null)
                .AddUserAttribute("data-placeholder", I18N.Translate(renderContext, placeholder))
                .AddUserAttribute("data-editable", editable ? "true" : null)
                .AddUserAttribute("data-uri", restUri?.ToString());

            return html;
        }
    }
}
