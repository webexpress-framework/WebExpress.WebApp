using System;
using System.Globalization;
using WebExpress.WebCore.Internationalization;

namespace WebExpress.WebApp.WebAttribute
{
    /// <summary>
    /// Ensures that a string ends with the specified suffix.
    /// </summary>
    [AttributeUsage(AttributeTargets.Property)]
    public sealed class ValidateEndsWithAttribute : Attribute, IValidation
    {
        /// <summary> 
        /// Gets the suffix that the string must end with. 
        /// </summary>
        public string Suffix { get; }

        /// <summary> 
        /// Gets the error message returned when validation fails. 
        /// </summary>
        public string Message { get; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="suffix">The required suffix that the string must end with.</param>
        /// <param name="message">
        /// The error message that will be returned when validation fails.
        /// </param>
        public ValidateEndsWithAttribute(string suffix, string message = null)
        {
            Suffix = suffix;
            Message = message ?? "webexpress.webapp:validation.endswith";
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
            if (value is string s && !s.EndsWith(Suffix))
            {
                errorMessage = I18N.Translate(culture, Message);
                return false;
            }

            errorMessage = string.Empty;
            return true;
        }
    }
}
