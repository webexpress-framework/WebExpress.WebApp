using System;
using WebExpress.WebCore.WebIcon;
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
        /// Gets or sets the mode that determines how the form behaves 
        /// or is rendered.
        /// </summary>
        public override Func<IRenderControlFormContext, string> Mode => _ => TypeRestFormMode.Edit.ToMode();

        /// <summary>
        /// Gets the submit button control for the form.
        /// </summary>
        public ControlFormItemButtonSubmit Submit { get; } = new ControlFormItemButtonSubmit
        {
            Text = _ => "webexpress.webui:edit.label",
            Icon = rennderContext => new IconFloppyDisk(rennderContext?.PageContext?.ApplicationContext.IconTheme ?? TypeIconTheme.Default),
            Color = _ => new PropertyColorButton(TypeColorButton.Success)
        };

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlRestFormEdit(string id = null)
            : base(id)
        {
            Method = _ => RequestMethod.PUT;

            AddPrimaryButton(Submit);
        }
    }
}