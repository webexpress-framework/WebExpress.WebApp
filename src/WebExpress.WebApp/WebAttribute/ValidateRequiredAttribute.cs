using System;
using System.Globalization;
using WebExpress.WebCore.Internationalization;

namespace WebExpress.WebApp.WebAttribute
{
    /// <summary>
    /// Ensures that a value is not null, empty or whitespace.
    /// </summary>
    [AttributeUsage(AttributeTargets.Property)]
    public sealed class ValidateRequiredAttribute : Attribute, IValidation
    {
        /// <summary> 
        /// Gets the error message returned when validation fails. 
        /// </summary>
        public string Message { get; }

        /// <summary>
        /// Initializes a new instance of the <see cref="ValidateRequiredAttribute"/> class.
        /// </summary>
        /// <param name="message">The error message returned when validation fails.</param>
        public ValidateRequiredAttribute(string message = null)
        {
            Message = message ?? "webexpress.webapp:validation.required";
        }

        /// <summary>
        /// Validates the given value.
        /// </summary>
        /// <param name="value">The value to validate.</param>
        /// <param name="culture">The culture.</param>
        /// <param name="errorMessage">The generated error message, if validation fails.</param>
        /// <returns>True if the value is valid; otherwise false.</returns>
        public bool IsValid(object value, CultureInfo culture, out string errorMessage)
        {
            // null check
            if (value == null)
            {
                errorMessage = I18N.Translate(culture, Message);
                return false;
            }

            // string-specific check
            if (value is string s && string.IsNullOrWhiteSpace(s))
            {
                errorMessage = I18N.Translate(culture, Message);
                return false;
            }

            errorMessage = string.Empty;
            return true;
        }
    }
}
