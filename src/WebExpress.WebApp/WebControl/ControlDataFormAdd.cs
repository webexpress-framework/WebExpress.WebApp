using System;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebTheme;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebIcon;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents a new form that retrieves and displays data from 
    /// a RESTful resource specified by a URI.
    /// </summary>
    public class ControlDataFormAdd : ControlDataForm
    {
        /// <summary>
        /// Gets or sets the mode that determines how the form behaves 
        /// or is rendered.
        /// </summary>
        public override Func<IRenderControlFormContext, string> Mode => _ => TypeRestFormMode.Add.ToMode();

        /// <summary>
        /// Gets the submit button control for the form.
        /// </summary>
        public ControlFormItemButtonSubmit Submit { get; } = new ControlFormItemButtonSubmit
        {
            Text = _ => "webexpress.webui:new.label",
            Icon = renderContext => new IconPlus(renderContext.GetIconTheme()),
            Color = _ => new PropertyColorButton(TypeColorButton.Success)
        };

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlDataFormAdd(string id = null)
            : base(id)
        {
            Method = _ => RequestMethod.POST;

            AddPrimaryButton(Submit);
        }
    }
}