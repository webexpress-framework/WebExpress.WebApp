using System;
using System.Globalization;
using WebExpress.WebCore.Internationalization;

namespace WebExpress.WebApp.WebAttribute
{
    /// <summary>
    /// Ensures that a string does not exceed the specified maximum length.
    /// </summary>
    [AttributeUsage(AttributeTargets.Property)]
    public sealed class ValidateMaxLengthAttribute : Attribute, IValidation
    {
        /// <summary> 
        /// Returns the maximum allowed length of the string. 
        /// </summary>
        public int Length { get; }

        /// <summary> 
        /// Returns the error message returned when validation fails. 
        /// </summary>
        public string Message { get; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="length">The maximum allowed string length.</param>
        /// <param name="message">
        /// The error message that will be returned when validation fails.
        /// </param>
        public ValidateMaxLengthAttribute(int length, string message = null)
        {
            Length = length;
            Message = message ?? "webexpress.webapp:validation.maxlength";
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
            if (value is string s)
            {
                if (s.Length > Length)
                {
                    errorMessage = I18N.Translate(culture, Message);
                    return false;
                }
            }

            errorMessage = string.Empty;
            return true;
        }
    }
}
