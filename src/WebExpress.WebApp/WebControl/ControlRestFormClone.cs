using System;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebTheme;
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
        /// Gets or sets the mode that determines how the form behaves 
        /// or is rendered.
        /// </summary>
        public override Func<IRenderControlFormContext, string> Mode => _ => TypeRestFormMode.Clone.ToMode();

        /// <summary>
        /// Gets the submit button control for the form.
        /// </summary>
        public ControlFormItemButtonSubmit Submit { get; } = new ControlFormItemButtonSubmit
        {
            Text = _ => "webexpress.webapp:clone.label",
            Icon = renderContext => new IconClone(renderContext.GetIconTheme()),
            Color = _ => new PropertyColorButton(TypeColorButton.Primary)
        };

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlRestFormClone(string id = null)
            : base(id)
        {
            Method = _ => RequestMethod.POST;

            AddPrimaryButton(Submit);
        }
    }
}