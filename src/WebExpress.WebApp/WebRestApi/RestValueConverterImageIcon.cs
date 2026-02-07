namespace WebExpress.WebApp.WebRestApi
{
    using global::WebExpress.WebUI.WebIcon;
    using System;

    namespace WebExpress.WebApp.WebRestApi
    {
        /// <summary>
        /// Converts between ImageIcon objects and their raw REST string representations.
        /// </summary>
        public class RestValueConverterImageIcon : IRestValueConverter
        {
            /// <summary>
            /// Converts a raw REST value (string) into an ImageIcon instance.
            /// </summary>
            /// <param name="rawValue">
            /// The raw value to convert. Expected to be a string representing the icon URI.
            /// </param>
            /// <param name="targetType">
            /// The target type for the conversion. Ignored in this implementation.
            /// </param>
            /// <returns>
            /// An ImageIcon instance created from the raw string value, or null if the input is null.
            /// </returns>
            public object FromRaw(object rawValue, Type targetType)
            {
                if (rawValue == null)
                {
                    return null;
                }

                if (rawValue is string uri)
                {
                    return ImageIcon.FromString(uri);
                }

                throw new InvalidOperationException
                (
                    $"RestValueConverterImageIcon expects a string but received {rawValue.GetType()}"
                );
            }

            /// <summary>
            /// Converts an ImageIcon instance into its REST-friendly string representation.
            /// </summary>
            /// <param name="value">
            /// The ImageIcon instance to convert. May be null.
            /// </param>
            /// <param name="sourceType">
            /// The source type for the conversion. Ignored in this implementation.
            /// </param>
            /// <returns>
            /// A string containing the icon URI, or null if the value is null.
            /// </returns>
            public object ToRaw(object value, Type sourceType)
            {
                if (value == null)
                {
                    return null;
                }

                if (value is ImageIcon icon)
                {
                    return icon.Uri?.ToString();
                }

                throw new InvalidOperationException
                (
                    $"RestValueConverterImageIcon can only convert ImageIcon values, but received {value.GetType()}"
                );
            }
        }
    }
}

