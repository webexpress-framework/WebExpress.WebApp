using WebExpress.WebCore.WebMessage;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebIcon;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents a clone form that retrieves and displays data from 
    /// a RESTful resource specified by a URI.
    /// </summary>
    public class ControlRestFormClone : ControlRestForm
    {
        /// <summary>
        /// Returns the submit button control for the form.
        /// </summary>
        public ControlFormItemButtonSubmit Submit { get; } = new ControlFormItemButtonSubmit
        {
            Text = "webexpress.webapp:clone.label",
            Icon = new IconCopy(),
            Color = new PropertyColorButton(TypeColorButton.Primary)
        };

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlRestFormClone(string id = null)
            : base(id)
        {
            Mode = TypeRestFormMode.Clone;
            Method = RequestMethod.POST;

            AddPrimaryButton(Submit);
        }
    }
}