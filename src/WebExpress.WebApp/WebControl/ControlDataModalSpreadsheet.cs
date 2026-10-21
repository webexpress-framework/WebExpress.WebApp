using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// A dialog that edits one workbook - a name and a spreadsheet filling the dialog - and
    /// separates the two things a single save button normally has to pretend are one: <i>do not
    /// lose what I have entered</i> and <i>let the readers see this</i>.
    /// </summary>
    /// <remarks>
    /// <para>
    /// A workbook is a document in the same sense a text is: it grows over an afternoon, its
    /// intermediate states are wrong in ways only the author knows, and a budget half updated is
    /// worse for its readers than last month's. So every change goes into an unpublished draft
    /// within a second of the work stopping, and the submit button publishes. Drafting,
    /// publishing, sharing and the bar are those of every document dialog and are described on
    /// <see cref="ControlDataModalDocument"/>; this control contributes the workbook.
    /// </para>
    /// <para>
    /// The body travels as the workbook's JSON, the value the spreadsheet posts under its field
    /// name, so the record and the draft endpoint read it with
    /// <c>SpreadsheetWorkbook.Parse</c> and answer it the same way. Formula cells carry their
    /// last result, so an endpoint reads figures without a formula engine.
    /// </para>
    /// <para>
    /// The reading view is the same workbook in a spreadsheet without toolbar, formula bar and
    /// editing: what a page showing the published workbook read-only would show.
    /// </para>
    /// </remarks>
    public class ControlDataModalSpreadsheet : ControlDataModalDocument, IControlDataModalSpreadsheet
    {
        /// <summary>
        /// Gets the css class the client controller is registered for.
        /// </summary>
        protected override string ControllerClass => "wx-webapp-modal-spreadsheet";

        /// <summary>
        /// Gets the css class of the rules that only a workbook in the dialog needs.
        /// </summary>
        protected override string KindClass => "wx-spreadsheet-form";

        /// <summary>
        /// Gets the input for the workbook.
        /// </summary>
        /// <remarks>
        /// The workbook is the work, so it is the only thing in the content area and takes all of
        /// it - which is what <see cref="ControlFormItemInputSpreadsheet.Fill"/> says. It carries
        /// no label: with the name in the dialog's own title bar there is nothing left for a
        /// caption to distinguish it from. Toolbar, formula bar, sheet tabs, size and language are
        /// the input's own settings and are configured on it.
        /// </remarks>
        public ControlFormItemInputSpreadsheet Body { get; } = new()
        {
            Required = _ => false,
            Fill = _ => true
        };

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlDataModalSpreadsheet(string id = null)
            : base(id)
        {
            Add(Body);
        }
    }
}
