using System;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents a visual form-editor control. The editor is a self-contained
    /// designer that loads, mutates and persists a form definition (tabs, groups,
    /// fields) via REST, into an unpublished draft where one is declared. All
    /// behaviour is driven client-side by the
    /// <c>webexpress.webapp.RestFormEditorCtrl</c> JavaScript controller.
    /// </summary>
    public interface IControlDataFormEditor : IControl, IControlData
    {
        /// <summary>
        /// Whether the live preview pane is shown initially.
        /// </summary>
        Func<IRenderControlContext, bool> Preview { get; }

        /// <summary>
        /// Whether mutations are written to the declared draft service rather
        /// than to the form itself.
        /// </summary>
        Func<IRenderControlContext, bool> Draft { get; }

        /// <summary>
        /// Tree indent in pixels (clamped client-side to 8–32).
        /// </summary>
        Func<IRenderControlContext, int> Indent { get; }

        /// <summary>
        /// Whether the editor is read-only (suppresses mutation UI and REST writes).
        /// </summary>
        Func<IRenderControlContext, bool> Readonly { get; }

        /// <summary>
        /// Whether the editor takes the height its host offers instead of growing
        /// with the form it edits.
        /// </summary>
        Func<IRenderControlContext, bool> Fill { get; }
    }
}
