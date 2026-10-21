using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// A form that edits one document - a title and a rich-text body - and separates the two
    /// things a single save button normally has to pretend are one: <i>do not lose what I have
    /// written</i> and <i>let the readers see this</i>.
    /// </summary>
    /// <remarks>
    /// <para>
    /// The control writes every change into an unpublished draft within a second of the typing
    /// stopping, and the submit button publishes. A form that only saves on submit loses an
    /// afternoon to a closed tab; a form that saves continuously publishes every unfinished
    /// sentence to whoever is reading the page. Drafting, publishing, sharing and the bar are
    /// those of every document dialog and are described on <see cref="ControlDataModalDocument"/>;
    /// this control contributes the rich-text body.
    /// </para>
    /// <para>
    /// The reading view is the one the content control (the client half of
    /// <see cref="ControlContent"/>) builds from the editor's value: the writing surface shows
    /// add-on frames, column resizers and the guard paragraphs around what cannot be typed into,
    /// the readers get none of them.
    /// </para>
    /// </remarks>
    public class ControlDataModalEditor : ControlDataModalDocument, IControlDataModalEditor
    {
        /// <summary>
        /// Gets the css class the client controller is registered for.
        /// </summary>
        protected override string ControllerClass => "wx-webapp-modal-editor";

        /// <summary>
        /// Gets the input for the document's rich-text body.
        /// </summary>
        /// <remarks>
        /// The body is the work, so it is the only thing in the content area and takes all of it
        /// - which is what <see cref="ControlFormItemInputText.Fill"/> says. It carries no label
        /// either: with the title in the dialog's own title bar there is nothing left for a
        /// caption to distinguish it from.
        /// </remarks>
        public ControlFormItemInputText Body { get; } = new()
        {
            Format = _ => TypeEditTextFormat.Wysiwyg,
            Required = _ => false,
            Fill = _ => true
        };

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlDataModalEditor(string id = null)
            : base(id)
        {
            Add(Body);
        }
    }
}
