using System;
using System.Globalization;
using WebExpress.WebCore.Internationalization;

namespace WebExpress.WebApp.WebAttribute
{
    /// <summary>
    /// Ensures that a string contains the specified substring.
    /// </summary>
    [AttributeUsage(AttributeTargets.Property)]
    public sealed class ValidateContainsAttribute : Attribute, IValidation
    {
        /// <summary> 
        /// Returns the substring that must appear in the validated string. 
        /// </summary>
        public string Substring { get; }

        /// <summary> 
        /// Returns the error message returned when validation fails. 
        /// </summary>
        public string Message { get; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="substring"> 
        /// The substring that must appear in the validated string. 
        /// </param>
        /// <param name="message">
        /// The error message that will be returned when validation fails.
        /// </param>
        public ValidateContainsAttribute(string substring, string message = null)
        {
            Substring = substring;
            Message = message ?? "webexpress.webapp:validation.contains";
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
            if (value is string s && !s.Contains(Substring))
            {
                errorMessage = I18N.Translate(culture, Message);
                return false;
            }

            errorMessage = string.Empty;
            return true;
        }
    }
}
