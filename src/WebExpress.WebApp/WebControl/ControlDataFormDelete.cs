using System;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebTheme;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebIcon;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents a delete form that retrieves and displays data from 
    /// a RESTful resource specified by a URI.
    /// </summary>
    public class ControlDataFormDelete : ControlDataForm
    {
        /// <summary>
        /// Gets or sets the mode that determines how the form behaves 
        /// or is rendered.
        /// </summary>
        public override Func<IRenderControlFormContext, string> Mode => _ => TypeRestFormMode.Delete.ToMode();

        /// <summary>
        /// Gets or sets the static text content displayed by the control form item.
        /// </summary>
        public ControlFormItemStaticText Content { get; set; } = new ControlFormItemStaticText()
        {
            Text = _ => "webexpress.webui:delete.description"
        };

        /// <summary>
        /// Gets the submit button control for the form.
        /// </summary>
        public ControlFormItemButtonSubmit Submit { get; } = new ControlFormItemButtonSubmit
        {
            Text = _ => "webexpress.webui:delete.label",
            Icon = renderContext => new IconTrash(),
            Color = _ => new PropertyColorButton(TypeColorButton.Danger)
        };

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlDataFormDelete(string id = null)
            : base(id)
        {
            Method = _ => RequestMethod.DELETE;

            Add(Content);
            AddPrimaryButton(Submit);
        }
    }
}