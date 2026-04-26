using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents a visual form-editor control. The editor is a self-contained
    /// designer that loads, mutates and persists a form definition (tabs, groups,
    /// fields) via REST. All behaviour is driven client-side by the
    /// <c>webexpress.webui.FormEditorCtrl</c> JavaScript controller.
    /// </summary>
    public interface IControlRestFormEditor : IControl
    {
        /// <summary>
        /// Identifier of the form to load on startup. When null, the editor
        /// renders an empty shell and waits for a programmatic <c>loadForm</c>
        /// call.
        /// </summary>
        string FormId { get; }

        /// <summary>
        /// Base URL of the <c>FormStructure</c> REST endpoint
        /// (e.g. <c>/api/1/FormStructure</c>). When null, the editor operates
        /// in offline-mock mode against the inline initial structure.
        /// </summary>
        IUri RestUri { get; }

        /// <summary>
        /// URL of the field-catalog REST endpoint (e.g.
        /// <c>/api/1/FormFieldCatalog</c>). When null, only a tiny built-in
        /// fallback catalog is offered.
        /// </summary>
        IUri FieldCatalogUri { get; }

        /// <summary>
        /// Whether the live preview pane is shown initially.
        /// </summary>
        bool Preview { get; }

        /// <summary>
        /// Tree indent in pixels (clamped client-side to 8–32).
        /// </summary>
        int Indent { get; }

        /// <summary>
        /// Whether the editor is read-only (suppresses mutation UI and REST writes).
        /// </summary>
        bool Readonly { get; }
    }
}
