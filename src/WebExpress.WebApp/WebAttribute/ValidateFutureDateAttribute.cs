using System;
using System.Globalization;
using WebExpress.WebCore.Internationalization;

namespace WebExpress.WebApp.WebAttribute
{
    /// <summary>
    /// Ensures that a DateTime value lies in the future.
    /// </summary>
    [AttributeUsage(AttributeTargets.Property)]
    public sealed class ValidateFutureDateAttribute : Attribute, IValidation
    {
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
        public ValidateFutureDateAttribute(string message = null)
        {
            Message = message ?? "webexpress.webapp:validation.futuredate";
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
            if (value is DateTime dt)
            {
                if (dt <= DateTime.UtcNow)
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
