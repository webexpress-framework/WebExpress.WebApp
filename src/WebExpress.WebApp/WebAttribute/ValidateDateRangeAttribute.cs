using System;
using System.Globalization;
using WebExpress.WebCore.Internationalization;

namespace WebExpress.WebApp.WebAttribute
{
    /// <summary>
    /// Ensures that a DateTime value lies within the specified range.
    /// </summary>
    [AttributeUsage(AttributeTargets.Property)]
    public sealed class ValidateDateRangeAttribute : Attribute, IValidation
    {
        /// <summary> 
        /// Gets the minimum allowed date (inclusive). 
        /// </summary>
        public DateTime Min { get; }

        /// <summary> 
        /// Gets the maximum allowed date (inclusive). 
        /// </summary>
        public DateTime Max { get; }

        /// <summary> 
        /// Gets the error message returned when validation fails. 
        /// </summary>
        public string Message { get; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="min">The minimum allowed date, provided as a parsable string.</param> 
        /// <param name="max">The maximum allowed date, provided as a parsable string.</param>
        /// <param name="message">
        /// The error message that will be returned when validation fails.
        /// </param>
        public ValidateDateRangeAttribute(string min, string max, string message = null)
        {
            Min = DateTime.Parse(min, CultureInfo.InvariantCulture);
            Max = DateTime.Parse(max, CultureInfo.InvariantCulture);
            Message = message ?? "webexpress.webapp:validation.daterange";
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
                if (dt < Min || dt > Max)
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
