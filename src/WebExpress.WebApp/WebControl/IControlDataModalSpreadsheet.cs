using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents a dialog that edits one workbook - a name and a spreadsheet - and separates the
    /// two things a single save button normally has to pretend are one: <i>do not lose what I have
    /// entered</i> and <i>let the readers see this</i>. Every change is written into an
    /// unpublished draft while the author works; the submit publishes.
    /// </summary>
    /// <remarks>
    /// The two meanings of save are two endpoints. The record service loads the workbook the
    /// dialog opens on and applies it on publish; the draft service stores, answers and drops the
    /// unpublished workbook. Without a declared draft service the control degrades to an
    /// ordinary edit form, which is why every draft-bound member is optional.
    /// </remarks>
    public interface IControlDataModalSpreadsheet : IControlDataModalDocument
    {
        /// <summary>
        /// Gets the input for the workbook. It is the only form item and takes the whole content
        /// area, because the workbook is the work.
        /// </summary>
        ControlFormItemInputSpreadsheet Body { get; }
    }
}
