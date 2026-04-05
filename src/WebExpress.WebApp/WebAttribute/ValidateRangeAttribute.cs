using System;
using System.Globalization;
using WebExpress.WebCore.Internationalization;

namespace WebExpress.WebApp.WebAttribute
{
    /// <summary>
    /// Ensures that a numeric value lies within the specified range.
    /// </summary>
    [AttributeUsage(AttributeTargets.Property)]
    public sealed class ValidateRangeAttribute : Attribute, IValidation
    {
        /// <summary> 
        /// Returns the minimum allowed numeric value. 
        /// </summary>
        public double Min { get; }

        /// <summary> 
        /// Returns the maximum allowed numeric value. 
        /// </summary>
        public double Max { get; }

        /// <summary> 
        /// Returns the error message returned when validation fails. 
        /// </summary>
        public string Message { get; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="min">The minimum allowed numeric value.</param>
        /// <param name="max">The maximum allowed numeric value.</param>
        /// <param name="message">
        /// The error message that will be returned when validation fails.
        /// </param>
        public ValidateRangeAttribute(double min, double max, string message = null)
        {
            Min = min;
            Max = max;
            Message = message ?? "webexpress.webapp:validation.range";
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
            if (value is IConvertible)
            {
                try
                {
                    double number = Convert.ToDouble(value);

                    if (number < Min || number > Max)
                    {
                        errorMessage = I18N.Translate(culture, Message);
                        return false;
                    }
                }
                catch
                {
                    // Non‑numeric types are considered valid
                }
            }

            errorMessage = string.Empty;
            return true;
        }
    }
}
