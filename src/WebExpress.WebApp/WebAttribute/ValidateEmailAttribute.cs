using System;
using System.Globalization;
using System.Text.RegularExpressions;
using WebExpress.WebCore.Internationalization;

namespace WebExpress.WebApp.WebAttribute
{
    /// <summary>
    /// Ensures that a string is a valid email address.
    /// </summary>
    [AttributeUsage(AttributeTargets.Property)]
    public sealed class ValidateEmailAttribute : Attribute, IValidation
    {
        private static readonly Regex EmailRegex = new Regex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$", RegexOptions.Compiled);

        /// <summary> 
        /// Gets the error message returned when validation fails. 
        /// </summary>
        public string Message { get; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="message">
        /// The error message that will be returned when validation fails.
        /// </param>
        public ValidateEmailAttribute(string message = null)
        {
            Message = message ?? "webexpress.webapp:validation.email";
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
                if (!EmailRegex.IsMatch(s))
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
