using System;
using System.Globalization;
using WebExpress.WebCore.Internationalization;

namespace WebExpress.WebApp.WebAttribute
{
    /// <summary>
    /// Ensures that a value is not equal to a specified disallowed value.
    /// </summary>
    [AttributeUsage(AttributeTargets.Property)]
    public sealed class ValidateNotEqualAttribute : Attribute, IValidation
    {
        /// <summary> 
        /// Gets the value that is not allowed. 
        /// If the validated value equals this value, validation fails. 
        /// </summary>
        public object Disallowed { get; }

        /// <summary> 
        /// Gets the error message returned when validation fails. 
        /// </summary>
        public string Message { get; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="disallowed">The value that is not allowed.</param>
        /// <param name="message">
        /// The error message that will be returned when validation fails.
        /// </param>
        public ValidateNotEqualAttribute(object disallowed, string message = null)
        {
            Disallowed = disallowed;
            Message = message ?? "webexpress.webapp:validation.notequal";
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
            if (Equals(value, Disallowed))
            {
                errorMessage = I18N.Translate(culture, Message);
                return false;
            }

            errorMessage = string.Empty;
            return true;
        }
    }
}
