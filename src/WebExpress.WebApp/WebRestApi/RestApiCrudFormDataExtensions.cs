using System;
using System.Collections.Generic;
using System.Reflection;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Provides extension methods for binding values from a RestApiCrudFormData 
    /// instance to the properties of a target object.
    /// </summary>
    public static class RestApiCrudFormDataExtensions
    {
        /// <summary>
        /// Populates the writable public properties of the specified target object 
        /// with values from the given form data payload, matching by property name.
        /// </summary>
        /// <param name="fieldMap">
        /// The form data payload containing key-value pairs to bind to the target 
        /// object's properties. Cannot be null.
        /// </param>
        /// <param name="target">
        /// The object whose writable public properties will be set using values from 
        /// the payload. Cannot be null.
        /// </param>
        public static void BindTo(this RestApiCrudFormData fieldMap, object target)
        {
            ArgumentNullException.ThrowIfNull(fieldMap);
            ArgumentNullException.ThrowIfNull(target);

            var type = target.GetType();
            var properties = type.GetProperties(BindingFlags.Public | BindingFlags.Instance);

            foreach (var prop in properties)
            {
                if (!prop.CanWrite)
                {
                    continue;
                }

                var key = prop.Name.ToLower();

                if (!fieldMap.TryGetValue(key, out var rawValue))
                {
                    continue;
                }

                if (rawValue == null)
                {
                    prop.SetValue(target, null);
                    continue;
                }

                try
                {
                    object convertedValue = ConvertValue(rawValue, prop.PropertyType);
                    prop.SetValue(target, convertedValue);
                }
                catch
                {
                }
            }
        }

        /// <summary>
        /// Converts the specified value to the given target type, supporting string-to-string 
        /// array conversion and standard type conversions.
        /// </summary>
        /// <param name="value">
        /// The value to convert. Can be any object, including a string to be split into a 
        /// string array.
        /// </param>
        /// <param name="targetType">
        /// The type to which the value should be converted. Must not be null.
        /// </param>
        /// <returns>
        /// An object representing the converted value, of the specified target type.
        /// </returns>
        private static object ConvertValue(object value, Type targetType)
        {
            if (typeof(IEnumerable<string>).IsAssignableFrom(targetType))
            {
                if (value is string s)
                {
                    var items = s.Split(";", StringSplitOptions.RemoveEmptyEntries);

                    if (targetType == typeof(string[]))
                    {
                        return items;
                    }

                    if (targetType == typeof(List<string>))
                    {
                        return new List<string>(items);
                    }

                    return items;
                }

                if (value is IEnumerable<string> enumerable)
                {
                    if (targetType == typeof(string[]))
                    {
                        return enumerable is string[] arr ? arr : [.. enumerable];
                    }

                    if (targetType == typeof(List<string>))
                    {
                        return enumerable is List<string> list ? list : [.. enumerable];
                    }

                    return enumerable;
                }
            }


            if (targetType.IsAssignableFrom(value.GetType()))
            {
                return value;
            }

            return Convert.ChangeType(value, targetType);
        }
    }

}
