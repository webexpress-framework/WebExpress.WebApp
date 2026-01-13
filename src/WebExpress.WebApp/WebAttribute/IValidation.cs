using System.Globalization;

namespace WebExpress.WebApp.WebAttribute
{
    /// <summary>
    /// Represents a validation rule that can validate a given value.
    /// </summary>
    public interface IValidation
    {
        /// <summary>
        /// Validates the given value.
        /// </summary>
        /// <param name="value">The value to validate.</param>
        /// <param name="culture">The culture.</param>
        /// <param name="errorMessage">The generated error message, if validation fails.</param>
        /// <returns>True if the value is valid; otherwise false.</returns>
        bool IsValid(object value, CultureInfo culture, out string errorMessage);
    }
}
