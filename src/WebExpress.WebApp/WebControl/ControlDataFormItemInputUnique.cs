using System;
using System.Collections.Generic;
using WebExpress.WebApp.WebControl;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebApiControl
{
    /// <summary>
    /// Represents a form input control that ensures uniqueness.
    /// </summary>
    public class ControlDataFormItemInputUnique : ControlFormItemInput<ControlFormInputValueString>, IControlData
    {
        /// <summary>
        /// Gets or sets the uri that determines the options.
        /// </summary>
        public Func<IRenderControlContext, IUri> RestUri { get; set; }

        /// <summary>
        /// Gets or sets the description.
        /// </summary>
        public Func<IRenderControlContext, string> Description { get; set; }

        /// <summary>
        /// Gets or sets a placeholder text.
        /// </summary>
        public Func<IRenderControlContext, string> Placeholder { get; set; }

        /// <summary>
        /// Gets or sets the minimum length.
        /// </summary>
        public Func<IRenderControlContext, uint?> MinLength { get; set; }

        /// <summary>
        /// Gets or sets the maximum length.
        /// </summary>
        public Func<IRenderControlContext, uint?> MaxLength { get; set; }

        /// <summary>
        /// Gets or sets a search pattern that checks the content.
        /// </summary>
        public Func<IRenderControlContext, string> Pattern { get; set; }

        /// <summary>
        /// Initializes a new instance of the class with an automatically assigned ID.
        /// </summary>
        public ControlDataFormItemInputUnique()
            : base(DeterministicId.Create())
        {
        }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlDataFormItemInputUnique(string id)
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
            var value = renderContext.GetValue<ControlFormInputValueString>(this);
            var name = Name?.Invoke(renderContext);
            var restUri = RestUri?.Invoke(renderContext)?.BindParameters(renderContext?.Request);
            var placeholder = Placeholder?.Invoke(renderContext);
            var minLength = MinLength?.Invoke(renderContext);
            var maxLength = MaxLength?.Invoke(renderContext);
            var pattern = Pattern?.Invoke(renderContext);

            var html = new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = "wx-webapp-input-unique"
            }
                .AddUserAttribute("name", name)
                .AddUserAttribute("placeholder", I18N.Translate(renderContext, placeholder))
                .AddUserAttribute("data-minlength", minLength >= 0 ? minLength.ToString() : null)
                .AddUserAttribute("data-maxlength", maxLength >= 0 ? maxLength.ToString() : null)
                .AddUserAttribute("data-pattern", pattern)
                .AddUserAttribute("data-value", value?.Text)
                .AddUserAttribute("data-uri", restUri?.ToString());

            return html;
        }

        /// <summary>
        /// Validates the input elements within a form for correctness of the data.
        /// </summary>
        /// <param name="renderContext">The context in which the inputs are validated, containing form data and state.</param>
        /// <returns>A collection of <see cref="ValidationResult"/> objects representing the validation 
        /// results for each input element. Each result indicates whether the input is valid or contains errors.
        /// </returns>
        public override IEnumerable<ValidationResult> Validate(IRenderControlFormContext renderContext)
        {
            var validationResults = new List<ValidationResult>(base.Validate(renderContext));
            var value = renderContext.GetValue<ControlFormInputValueString>(this)?.Text;
            var disabled = Disabled?.Invoke(renderContext) ?? false;
            var required = Required?.Invoke(renderContext) ?? false;

            if (disabled)
            {
                return [];
            }

            if (required && string.IsNullOrWhiteSpace(value))
            {
                validationResults.AddRange(new ValidationResult(TypeInputValidity.Error, "webexpress.webui:form.inputtextbox.validation.required"));

                return validationResults;
            }

            if (value is not null && int.TryParse(MinLength?.ToString(), out var minLength) && minLength > value.Length)
            {
                validationResults.AddRange(new ValidationResult(TypeInputValidity.Error, string.Format(I18N.Translate(renderContext, "webexpress.webui:form.inputtextbox.validation.min"), MinLength)));
            }

            if (value is not null && int.TryParse(MaxLength?.ToString(), out var maxLength) && maxLength < value.Length)
            {
                validationResults.AddRange(new ValidationResult(TypeInputValidity.Error, string.Format(I18N.Translate(renderContext, "webexpress.webui:form.inputtextbox.validation.max"), MaxLength)));
            }

            return validationResults;
        }

        /// <summary>
        /// Creates an value from the specified string representation.
        /// </summary>
        /// <param name="value">
        /// The string representation of the value to be converted. Cannot be null.
        /// </param>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <returns>
        /// The value created from the specified string representation.
        /// </returns>
        protected override ControlFormInputValueString CreateValue(string value, IRenderControlFormContext renderContext)
        {
            return new ControlFormInputValueString(value);
        }
    }
}
