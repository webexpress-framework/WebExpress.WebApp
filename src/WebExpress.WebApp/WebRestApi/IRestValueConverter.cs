using System;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Defines methods for converting values between their raw REST representation and .NET types.
    /// </summary>
    public interface IRestValueConverter
    {
        /// <summary>
        /// Converts a raw value to the specified target type.
        /// </summary>
        /// <param name="rawValue">
        /// The value to convert. Can be any object representing the raw data to be transformed.
        /// </param>
        /// <param name="targetType">
        /// The type to which the raw value should be converted. Cannot be null.
        /// </param>
        /// <returns>
        /// An object of the specified target type representing the converted value.
        /// </returns>
        object FromRaw(object rawValue, Type targetType);

        /// <summary>
        /// Converts the specified value to its raw representation based on the provided source type.
        /// </summary>
        /// <param name="value">
        /// The value to convert to a raw representation. Can be null if the conversion supports 
        /// null values.</param>
        /// <param name="sourceType">
        /// The type that describes how the value should be interpreted and converted. Cannot be null.
        /// </param>
        /// <returns>
        /// An object representing the raw form of the input value, as determined by the source type.
        /// </returns>
        object ToRaw(object value, Type sourceType);
    }
}
