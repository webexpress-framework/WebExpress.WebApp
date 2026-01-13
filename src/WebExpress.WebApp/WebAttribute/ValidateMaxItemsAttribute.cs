using System;
using System.Collections;
using System.Globalization;
using WebExpress.WebCore.Internationalization;

namespace WebExpress.WebApp.WebAttribute
{
    /// <summary>
    /// Ensures that a collection does not exceed the specified number of items.
    /// </summary>
    [AttributeUsage(AttributeTargets.Property)]
    public sealed class ValidateMaxItemsAttribute : Attribute, IValidation
    {
        /// <summary> 
        /// Returns the maximum allowed number of items in the collection. 
        /// </summary>
        public int Count { get; }

        /// <summary> 
        /// Returns the error message returned when validation fails. 
        /// </summary>
        public string Message { get; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="count">The maximum allowed number of items.</param>
        /// <param name="message">
        /// The error message that will be returned when validation fails.
        /// </param>
        public ValidateMaxItemsAttribute(int count, string message = null)
        {
            Count = count;
            Message = message ?? "webexpress.webapp:validation.maxitems";
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
            if (value is ICollection col && col.Count > Count)
            {
                errorMessage = I18N.Translate(culture, Message);
                return false;
            }

            errorMessage = string.Empty;
            return true;
        }
    }
}
