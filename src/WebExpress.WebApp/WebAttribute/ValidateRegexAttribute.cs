using System;
using System.Globalization;
using System.Text.RegularExpressions;
using WebExpress.WebCore.Internationalization;

namespace WebExpress.WebApp.WebAttribute
{
    /// <summary>
    /// Ensures that a string matches the specified regular expression.
    /// </summary>
    [AttributeUsage(AttributeTargets.Property)]
    public sealed class ValidateRegexAttribute : Attribute, IValidation
    {
        /// <summary> 
        /// Returns the regular expression pattern that the string must match. 
        /// </summary>
        public string Pattern { get; }

        /// <summary> 
        /// Returns the error message returned when validation fails. 
        /// </summary>
        public string Message { get; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="pattern"> 
        /// The regular expression pattern that the string must match. 
        /// </param>
        /// <param name="message">
        /// The error message that will be returned when validation fails.
        /// </param>
        public ValidateRegexAttribute(string pattern, string message = null)
        {
            Pattern = pattern;
            Message = message ?? "webexpress.webapp:validation.regex";
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
                if (!Regex.IsMatch(s, Pattern))
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
