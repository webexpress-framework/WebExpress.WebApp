using WebExpress.WebCore.WebMessage;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebIcon;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents a edit form that retrieves and displays data from 
    /// a RESTful resource specified by a URI.
    /// </summary>
    public class ControlRestFormEdit : ControlRestForm
    {
        /// <summary>
        /// Gets the submit button control for the form.
        /// </summary>
        public ControlFormItemButtonSubmit Submit { get; } = new ControlFormItemButtonSubmit
        {
            Text = "webexpress.webui:edit.label",
            Icon = new IconSave(),
            Color = new PropertyColorButton(TypeColorButton.Success)
        };

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlRestFormEdit(string id = null)
            : base(id)
        {
            Mode = TypeRestFormMode.Edit;
            Method = RequestMethod.PUT;

            AddPrimaryButton(Submit);
        }
    }
}