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
        string RestUrl { get; }

        /// <summary>
        /// URL of the field-catalog REST endpoint (e.g.
        /// <c>/api/1/FormFieldCatalog</c>). When null, only a tiny built-in
        /// fallback catalog is offered.
        /// </summary>
        string FieldCatalogUrl { get; }

        /// <summary>
        /// Initial layout of the designer. One of <c>two-pane</c>,
        /// <c>tree-table</c>, <c>three-pane</c>. Defaults to <c>two-pane</c>.
        /// </summary>
        string Layout { get; }

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

        /// <summary>
        /// Optional inline JSON snapshot of the initial structure
        /// (matches <c>FormStructureDto</c>). Allows server-side rendering with
        /// no first-load REST round-trip; takes precedence over
        /// <see cref="FormId"/> when both are set.
        /// </summary>
        string InitialStructureJson { get; }
    }
}
