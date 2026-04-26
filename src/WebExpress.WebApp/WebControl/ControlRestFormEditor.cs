using System.Globalization;
using System.Linq;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Visual form-editor control. Renders a <c>&lt;div class="wx-webui-form-editor"&gt;</c>
    /// host element with declarative <c>data-*</c> attributes. The associated
    /// <c>webexpress.webui.FormEditorCtrl</c> JavaScript controller hydrates the
    /// host element with the full Designer UI (tab bar, structure tree, live
    /// preview, palette, QuickAdd picker, drag-and-drop, keyboard shortcuts).
    /// </summary>
    public class ControlRestFormEditor : Control, IControlRestFormEditor
    {
        public const int _defaultIndent = 18;

        /// <summary>
        /// Gets or sets the unique identifier of the form.
        /// </summary>
        public string FormId { get; set; }

        /// <summary>
        /// Gets or sets the base URI used for REST API requests.
        /// </summary>
        public IUri RestUri { get; set; }

        /// <summary>
        /// Gets or sets the URI of the field catalog resource.
        /// </summary>
        public IUri FieldCatalogUri { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether preview mode is enabled.
        /// </summary>
        public bool Preview { get; set; } = true;

        /// <summary>
        /// Gets or sets the number of spaces used for each indentation level.
        /// </summary>
        public int Indent { get; set; } = _defaultIndent;

        /// <summary>
        /// Gets or sets a value indicating whether the object is read-only.
        /// </summary>
        public bool Readonly { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The id of the control.</param>
        public ControlRestFormEditor(string id = null)
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
            return Render(renderContext, visualTree, RestUri, FieldCatalogUri, Readonly);
        }

        /// <summary>
        /// Converts the control to an HTML representation.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <param name="visualTree">The visual tree representing the control's structure.</param>
        /// <param name="restUri">The base URI used for REST API requests.</param>
        /// <param name="fieldCatalogUri">The URI of the field catalog resource.</param>
        /// <param name="readonly">A value indicating whether the object is read-only.</param>
        /// <returns>An HTML node representing the rendered control.</returns>
        public virtual IHtmlNode Render(IRenderControlContext renderContext, IVisualTreeControl visualTree, IUri restUri, IUri fieldCatalogUri, bool @readonly)
        {
            var classes = Classes.ToList();
            var indent = Indent < 8 ? 8 : Indent > 32 ? 32 : Indent;

            var html = new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-restform-editor", classes),
                Style = GetStyles(),
                Role = Role
            }
                .AddUserAttribute("data-form-id", FormId)
                .AddUserAttribute("data-rest-url", restUri?.ToString())
                .AddUserAttribute("data-field-catalog-url", fieldCatalogUri?.ToString())
                .AddUserAttribute("data-preview", !Preview ? "false" : null)
                .AddUserAttribute("data-indent", indent != 18 ? indent.ToString(CultureInfo.InvariantCulture) : null)
                .AddUserAttribute("data-readonly", @readonly ? "true" : null);

            return html;
        }
    }
}
