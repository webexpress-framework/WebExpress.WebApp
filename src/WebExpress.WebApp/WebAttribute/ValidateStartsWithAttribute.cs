using System;
using System.Globalization;
using WebExpress.WebCore.Internationalization;

namespace WebExpress.WebApp.WebAttribute
{
    /// <summary>
    /// Ensures that a string starts with the specified prefix.
    /// </summary>
    [AttributeUsage(AttributeTargets.Property)]
    public sealed class ValidateStartsWithAttribute : Attribute, IValidation
    {
        /// <summary> 
        /// Gets the prefix that the string must start with. 
        /// </summary>
        public string Prefix { get; }

        /// <summary> 
        /// Gets the error message returned when validation fails. 
        /// </summary>
        public string Message { get; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="prefix"> 
        /// The required prefix that the string must start with. 
        /// </param>
        /// <param name="message">
        /// The error message that will be returned when validation fails.
        /// </param>
        public ValidateStartsWithAttribute(string prefix, string message = null)
        {
            Prefix = prefix;
            Message = message ?? "webexpress.webapp:validation.startswith";
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
            if (value is string s && !s.StartsWith(Prefix))
            {
                errorMessage = I18N.Translate(culture, Message);
                return false;
            }

            errorMessage = string.Empty;
            return true;
        }
    }
}
