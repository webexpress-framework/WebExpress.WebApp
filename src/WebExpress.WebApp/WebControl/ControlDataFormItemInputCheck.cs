using System;
using System.Collections.Generic;
using WebExpress.WebApp.WebControl;
using WebExpress.WebApp.WebData;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebApiControl
{
    /// <summary>
    /// Represents a REST-backed checkbox form input control. The current
    /// checked state is retrieved from the configured data service when the
    /// control is rendered without an initial value. If
    /// <see cref="InitialChecked"/> is set, it takes precedence and no GET
    /// request is issued. Subsequent state changes are forwarded to the same
    /// endpoint via POST.
    /// </summary>
    public class ControlDataFormItemInputCheck : ControlFormItemInputCheck, IControlData, IDataIsland
    {
        /// <summary>
        /// Gets the data service descriptors of the control, emitted as
        /// wx-service island elements. The data service reads and persists the
        /// checked state.
        /// </summary>
        public IList<Func<IRenderControlContext, DataServiceDescriptor>> ServiceFactories { get; } = [];

        /// <summary>
        /// Gets or sets the single data service descriptor, as a convenience for
        /// the common control with exactly one service. Reading returns the
        /// first declared service, assigning replaces all declared services.
        /// </summary>
        public Func<IRenderControlContext, DataServiceDescriptor> ServiceFactory
        {
            get => ServiceFactories.Count > 0 ? ServiceFactories[0] : null;
            set
            {
                ServiceFactories.Clear();

                if (value != null)
                {
                    ServiceFactories.Add(value);
                }
            }
        }

        /// <summary>
        /// Gets or sets the optional template reference, emitted as the
        /// data-wx-template attribute.
        /// </summary>
        public Func<IRenderControlContext, string> TemplateFactory { get; set; }

        /// <summary>
        /// Gets or sets the optional initial state, emitted as the wx-state island.
        /// </summary>
        public Func<IRenderControlContext, DataState> StateFactory { get; set; }

        /// <summary>
        /// Gets or sets the initial checked state. When set, the client
        /// uses this value instead of issuing a GET request against the
        /// data service. When left unset, the client performs a GET to
        /// retrieve the current state.
        /// </summary>
        public Func<IRenderControlContext, bool?> InitialChecked { get; set; }

        /// <summary>
        /// Initializes a new instance of the class with an automatically assigned ID.
        /// </summary>
        public ControlDataFormItemInputCheck()
            : base()
        {
        }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlDataFormItemInputCheck(string id)
            : base(id)
        {
        }

        /// <summary>
        /// Converts the control to an HTML representation.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <param name="visualTree">The visual tree representing the control's structure.</param>
        /// <returns>An HTML node representing the rendered control.</returns>
        public override IHtmlNode Render(IRenderControlFormContext renderContext, IVisualTreeControl visualTree)
        {
            var initialChecked = InitialChecked?.Invoke(renderContext);

            var hasInitialValue = initialChecked.HasValue;
            var isChecked = initialChecked ?? renderContext.GetValue<ControlFormInputValueBool>(this)?.Checked ?? false;
            var name = Name?.Invoke(renderContext);
            var disabled = Disabled?.Invoke(renderContext) ?? false;
            var layout = Layout?.Invoke(renderContext);
            var inline = Inline?.Invoke(renderContext) ?? false;
            var description = Description?.Invoke(renderContext);

            var html = new HtmlElementTextContentDiv()
            {
                Class = Css.Concatenate("wx-webapp-input-check", layout?.ToClass(), inline ? "form-check-inline" : null, GetClasses(renderContext)),
                Style = GetStyles(renderContext)
            }
                .Add(new HtmlElementFieldInput()
                {
                    Id = Id,
                    Name = name,
                    Type = "checkbox",
                    Disabled = disabled,
                    Class = Css.Concatenate("form-check-input"),
                    Checked = isChecked
                })
                .Add(new HtmlElementFieldLabel()
                {
                    Class = Css.Concatenate("form-check-label"),
                    For = Id
                }
                    .Add(new HtmlText(string.IsNullOrWhiteSpace(description) ?
                        string.Empty :
                        I18N.Translate(renderContext.Request?.Culture, description)
                    )))
                .EmitDataIslands(this, renderContext)
                .AddUserAttribute("data-value", hasInitialValue ? (isChecked ? "true" : "false") : null);

            return html;
        }
    }
}
