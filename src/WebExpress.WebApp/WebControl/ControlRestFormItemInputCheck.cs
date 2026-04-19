using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebApiControl
{
    /// <summary>
    /// Represents a REST-backed checkbox form input control. The current
    /// checked state is retrieved from the REST endpoint referenced by
    /// <see cref="RestUri"/> when the control is rendered without an
    /// initial value. If <see cref="InitialChecked"/> is set, it takes
    /// precedence and no GET request is issued. Subsequent state changes
    /// are forwarded to the same endpoint via POST.
    /// </summary>
    public class ControlRestFormItemInputCheck : ControlFormItemInputCheck
    {
        /// <summary>
        /// Gets or sets the uri of the REST endpoint used to read and
        /// persist the checked state.
        /// </summary>
        public IUri RestUri { get; set; }

        /// <summary>
        /// Gets or sets the initial checked state. When set, the client
        /// uses this value instead of issuing a GET request against
        /// <see cref="RestUri"/>. When left unset, the client performs a
        /// GET to retrieve the current state.
        /// </summary>
        public bool? InitialChecked { get; set; }

        /// <summary>
        /// Initializes a new instance of the class with an automatically assigned ID.
        /// </summary>
        public ControlRestFormItemInputCheck()
            : base()
        {
        }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlRestFormItemInputCheck(string id)
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
            var hasInitialValue = InitialChecked.HasValue;
            var isChecked = InitialChecked ?? renderContext.GetValue<ControlFormInputValueBool>(this)?.Checked ?? false;

            var html = new HtmlElementTextContentDiv()
            {
                Class = Css.Concatenate("wx-webapp-input-check", Layout.ToClass(), Inline ? "form-check-inline" : null, GetClasses()),
                Style = GetStyles()
            }
                .Add(new HtmlElementFieldInput()
                {
                    Id = Id,
                    Name = Name,
                    Type = "checkbox",
                    Disabled = Disabled,
                    Class = Css.Concatenate("form-check-input"),
                    Checked = isChecked
                })
                .Add(new HtmlElementFieldLabel()
                {
                    Class = Css.Concatenate("form-check-label"),
                    For = Id
                }
                    .Add(new HtmlText(string.IsNullOrWhiteSpace(Description) ?
                        string.Empty :
                        I18N.Translate(renderContext.Request?.Culture, Description)
                    )))
                .AddUserAttribute("data-uri", RestUri?.ToString())
                .AddUserAttribute("data-value", hasInitialValue ? (isChecked ? "true" : "false") : null);

            return html;
        }
    }
}
