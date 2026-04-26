using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using WebExpress.WebCore.WebHtml;
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
        /// <summary>Default tree indent in pixels.</summary>
        public const int DefaultIndent = 18;

        /// <summary>Default designer layout.</summary>
        public const string DefaultLayout = "two-pane";

        private static readonly HashSet<string> KnownLayouts = new(System.StringComparer.OrdinalIgnoreCase)
        {
            "two-pane", "tree-table", "three-pane"
        };

        /// <inheritdoc/>
        public string FormId { get; set; }

        /// <inheritdoc/>
        public string RestUrl { get; set; }

        /// <inheritdoc/>
        public string FieldCatalogUrl { get; set; }

        /// <inheritdoc/>
        public string Layout { get; set; } = DefaultLayout;

        /// <inheritdoc/>
        public bool Preview { get; set; } = true;

        /// <inheritdoc/>
        public int Indent { get; set; } = DefaultIndent;

        /// <inheritdoc/>
        public bool Readonly { get; set; }

        /// <inheritdoc/>
        public string InitialStructureJson { get; set; }

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
            var classes = Classes.ToList();
            var layout = string.IsNullOrWhiteSpace(Layout) || !KnownLayouts.Contains(Layout)
                ? DefaultLayout
                : Layout.ToLowerInvariant();
            var indent = Indent < 8 ? 8 : Indent > 32 ? 32 : Indent;

            var html = new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-restform-editor", classes),
                Style = GetStyles(),
                Role = Role
            }
                .AddUserAttribute("data-form-id", string.IsNullOrEmpty(FormId) ? null : FormId)
                .AddUserAttribute("data-rest-url", string.IsNullOrEmpty(RestUrl) ? null : RestUrl)
                .AddUserAttribute("data-field-catalog-url", string.IsNullOrEmpty(FieldCatalogUrl) ? null : FieldCatalogUrl)
                .AddUserAttribute("data-layout", layout)
                .AddUserAttribute("data-preview", Preview ? "true" : "false")
                .AddUserAttribute("data-indent", indent.ToString(CultureInfo.InvariantCulture))
                .AddUserAttribute("data-readonly", Readonly ? "true" : null)
                .AddUserAttribute("data-initial-structure", string.IsNullOrEmpty(InitialStructureJson) ? null : InitialStructureJson);

            return html;
        }
    }
}
