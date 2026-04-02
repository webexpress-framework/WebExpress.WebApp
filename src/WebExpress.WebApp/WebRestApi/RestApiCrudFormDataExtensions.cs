using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Reflection;
using WebExpress.WebApp.WebAttribute;
using WebExpress.WebCore.WebRestApi;
using WebExpress.WebIndex;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Provides extension methods for binding values from a RestApiCrudFormData 
    /// instance to the properties of a target object.
    /// </summary>
    public static class RestApiCrudFormDataExtensions
    {
        /// <summary>
        /// Validates the key-value pairs against the validation attributes applied 
        /// to the properties of the specified type.
        /// </summary>
        /// <typeparam name="TIndeItem">
        /// The target type whose property validation attributes should be applied.
        /// </typeparam>
        /// <param name="fieldMap">
        /// The RestApiCrudFormData instance containing the payload for validation.
        /// </param>
        /// <param name="culture">The culture.</param>
        /// <returns>
        /// A RestApiValidationResult containing validation errors for each property/field.
        /// </returns>
        public static IRestApiValidationResult Validate<TIndeItem>(this RestApiCrudFormData fieldMap, CultureInfo culture)
             where TIndeItem : IIndexItem
        {
            var result = new RestApiValidationResult();
            var properties = typeof(TIndeItem).GetProperties(BindingFlags.Public | BindingFlags.Instance);

            // always use braces for control structures
            foreach (var kv in fieldMap)
            {
                // find the target property by name (case insensitive)
                var property = properties.FirstOrDefault
                (
                    p =>
                    string.Equals(p.Name, kv.Key, StringComparison.OrdinalIgnoreCase)
                );

                if (property is null)
                {
                    // property not found, skip value
                    continue;
                }

                var attributes = property.GetCustomAttributes(true)
                    .OfType<IValidation>()
                    .ToList();

                if (attributes.Count == 0)
                {
                    continue;
                }

                object value = kv.Value;

                foreach (var validation in attributes)
                {
                    if (!validation.IsValid(value, culture, out string errorMessage))
                    {
                        result.Add(errorMessage ?? $"Validation failed for '{property.Name}'.", property.Name);
                    }
                }
            }

            return result;
        }

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
                // skip properties that cannot be written to
                if (!prop.CanWrite)
                {
                    continue;
                }

                var key = prop.Name.ToLowerInvariant();

                // skip if the field is not present in the payload
                if (!fieldMap.TryGetValue(key, out var rawValue))
                {
                    continue;
                }

                if (rawValue is null)
                {
                    prop.SetValue(target, null);
                    continue;
                }

                try
                {
                    // check for a generic RestConverterAttribute<TConverter>
                    var converterAttr = prop
                        .GetCustomAttributes(inherit: true)
                        .FirstOrDefault(a =>
                            a.GetType().IsGenericType &&
                            a.GetType().GetGenericTypeDefinition() == typeof(RestConverterAttribute<>));

                    if (converterAttr is not null)
                    {
                        // extract the converter type from the attribute
                        var converterType = (Type)converterAttr
                            .GetType()
                            .GetProperty(nameof(RestConverterAttribute<IRestValueConverter>.ConverterType))
                            .GetValue(converterAttr);

                        // instantiate the converter
                        var converter = (IRestValueConverter)Activator.CreateInstance(converterType);

                        // convert the raw value into the target type
                        var converted = converter.FromRaw(rawValue, prop.PropertyType);

                        // assign the converted value
                        prop.SetValue(target, converted);
                        continue;
                    }

                    // fallback
                    var convertedValue = ConvertValue(rawValue, prop.PropertyType);
                    prop.SetValue(target, convertedValue);
                }
                catch
                {
                    // ignore
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
            if (targetType == typeof(string))
            {
                return value;
            }
            else if (targetType.GetInterfaces().Any(i => i.IsGenericType && i.GetGenericTypeDefinition() == typeof(IEnumerable<>)))
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
