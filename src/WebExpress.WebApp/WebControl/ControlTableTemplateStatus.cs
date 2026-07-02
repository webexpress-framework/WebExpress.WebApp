using System;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Renders a cell value as a colored status dot within a table template. The
    /// cell value is expected to be one of the status tokens (<c>pending</c>,
    /// <c>running</c>, <c>warning</c>, <c>error</c>, <c>done</c>) or empty for none.
    /// It condenses a per-row status into one at-a-glance signal - the table analog
    /// of the <see cref="ControlStatusTask"/> dot - reusing the same palette
    /// (red error, green done, yellow warning, blue running, gray pending).
    /// </summary>
    public class ControlTableTemplateStatus : IControlTableTemplate
    {
        /// <summary>
        /// Gets or sets the unique identifier for the object.
        /// </summary>
        public string Id { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether the translated status name is
        /// rendered as a caption next to the dot. When false only the dot is shown
        /// and the name travels as the tooltip.
        /// </summary>
        public Func<IRenderControlContext, bool> ShowLabel { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The id of the control.</param>
        public ControlTableTemplateStatus(string id = null)
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
            var showLabel = ShowLabel?.Invoke(renderContext) ?? false;

            return new HtmlElement("template")
            {
                Id = Id
            }
                .AddUserAttribute("data-type", "status")
                .AddUserAttribute("data-show-label", showLabel ? "true" : null);
        }
    }
}
