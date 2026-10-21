using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents a form that edits one document - a title and a rich-text body - and separates
    /// the two things a single save button normally has to pretend are one: <i>do not lose what
    /// I have written</i> and <i>let the readers see this</i>. Every change is written into an
    /// unpublished draft while the author types; the submit publishes.
    /// </summary>
    /// <remarks>
    /// The two meanings of save are two endpoints. The record service loads the values the
    /// editor opens on and applies them on publish; the draft service stores, answers and drops
    /// the unpublished text. Without a declared draft service the control degrades to an
    /// ordinary edit form, which is why every draft-bound member is optional.
    /// </remarks>
    public interface IControlDataModalEditor : IControlDataModalDocument
    {
        /// <summary>
        /// Gets the input for the document's rich-text body. It is the only form item and takes
        /// the whole content area, because the writing surface is the work.
        /// </summary>
        ControlFormItemInputText Body { get; }
    }
}
