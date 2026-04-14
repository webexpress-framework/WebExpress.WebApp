using System;
using System.Globalization;
using WebExpress.WebCore.Internationalization;

namespace WebExpress.WebApp.WebAttribute
{
    /// <summary>
    /// Ensures that a string has exactly the specified length.
    /// </summary>
    [AttributeUsage(AttributeTargets.Property)]
    public sealed class ValidateExactLengthAttribute : Attribute, IValidation
    {
        /// <summary> 
        /// Gets the exact required length of the string. 
        /// </summary>
        public int Length { get; }

        /// <summary> 
        /// Gets the error message returned when validation fails. 
        /// </summary>
        public string Message { get; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="length">The exact required string length.</param>
        /// <param name="message">
        /// The error message that will be returned when validation fails.
        /// </param>
        public ValidateExactLengthAttribute(int length, string message = null)
        {
            Length = length;
            Message = message ?? "webexpress.webapp:validation.exactlength";
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
            if (value is string s && s.Length != Length)
            {
                errorMessage = I18N.Translate(culture, Message);
                return false;
            }

            errorMessage = string.Empty;
            return true;
        }
    }
}
