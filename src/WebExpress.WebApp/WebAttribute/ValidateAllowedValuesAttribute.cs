using System;
using System.Globalization;
using System.Linq;
using WebExpress.WebCore.Internationalization;

namespace WebExpress.WebApp.WebAttribute
{
    /// <summary>
    /// Ensures that a value is one of the allowed values.
    /// </summary>
    [AttributeUsage(AttributeTargets.Property)]
    public sealed class ValidateAllowedValuesAttribute : Attribute, IValidation
    {
        /// <summary> 
        /// Returns the list of allowed values. The validated value must match one of these. 
        /// </summary>
        public object[] Values { get; }

        /// <summary> 
        /// Returns the error message returned when validation fails. 
        /// </summary>
        public string Message { get; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="message">
        /// The error message that will be returned when validation fails.
        /// </param>
        /// <param name="values"> 
        /// The list of allowed values. The validated value must match one of these. 
        /// </param>
        public ValidateAllowedValuesAttribute(string message = null, params object[] values)
        {
            Values = values;
            Message = message ?? "webexpress.webapp:validation.allowedvalues";
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
            if (value is null)
            {
                errorMessage = string.Empty;
                return true;
            }

            if (!Values.Contains(value))
            {
                errorMessage = I18N.Translate(culture, Message);
                return false;
            }

            errorMessage = string.Empty;
            return true;
        }
    }
}
