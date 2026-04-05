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
        /// Returns or sets the unique identifier for the object.
        /// </summary>
        public string Id { get; set; }

        /// <summary>
        /// Returns or sets a value indicating whether the current template is editable or read-only.
        /// </summary>
        public bool Editable { get; set; }

        /// <summary>
        /// Allows you to select multiple items.
        /// </summary>
        public bool MultiSelect { get; set; }

        /// <summary>
        /// Returns or sets the placeholder text displayed when the input field is empty.
        /// </summary>
        public string Placeholder { get; set; }

        /// <summary>
        /// Returns or sets the uri that determines the data.
        /// </summary>
        public IUri RestUri { get; set; }

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
            var html = new HtmlElement("template")
            {
                Id = Id
            }
                .AddUserAttribute("data-type", "rest_selection")
                .AddUserAttribute("data-multiselection", MultiSelect ? "true" : null)
                .AddUserAttribute("data-placeholder", I18N.Translate(renderContext, Placeholder))
                .AddUserAttribute("data-editable", Editable ? "true" : null)
                .AddUserAttribute("data-uri", RestUri?.ToString());

            return html;
        }
    }
}
