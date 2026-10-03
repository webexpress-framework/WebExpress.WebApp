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
        /// <remarks>
        /// A form submits every value as text, so the binder converts. Beyond the standard
        /// conversions it follows three rules, which together decide what a payload can and
        /// cannot say about a property:
        /// <list type="bullet">
        /// <item>A property the payload does not mention keeps its value. Only what is sent
        /// is written, so a form carrying part of an entity cannot empty the rest of it.</item>
        /// <item>A <see cref="Guid"/> is parsed from its text, which
        /// <c>Convert.ChangeType</c> cannot do, so a reference reaches the property it is
        /// meant for instead of being dropped.</item>
        /// <item>An entry that names nothing — an empty text, a null, the empty guid, which
        /// is what a selection submits for its "none" entry — clears a property that can hold
        /// null and leaves one that cannot. A required reference is therefore never
        /// overwritten with an empty one, and an optional one can be cleared.</item>
        /// </list>
        /// A value that cannot be converted at all leaves the property as it is; the binder
        /// reports nothing, so a payload whose entries have to be rejected rather than
        /// ignored belongs in a validation.
        /// </remarks>
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
                    // a null entry clears a property that can hold null; one that cannot is
                    // left as it is, because reflection would throw on the assignment and
                    // take the rest of the binding with it
                    if (!prop.PropertyType.IsValueType || Nullable.GetUnderlyingType(prop.PropertyType) is not null)
                    {
                        prop.SetValue(target, null);
                    }

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
                    if (TryConvertValue(rawValue, prop.PropertyType, out var convertedValue))
                    {
                        prop.SetValue(target, convertedValue);
                    }
                }
                catch
                {
                    // ignore
                }
            }
        }

        /// <summary>
        /// Converts the specified value to the given target type, taking a nullable target
        /// and a guid target off the path of the general conversion.
        /// </summary>
        /// <remarks>
        /// A form submits every value as text. <see cref="Convert.ChangeType(object, Type)"/>
        /// knows no conversion from text to a <see cref="Guid"/> and none to a nullable type
        /// at all, so a property holding a reference or an optional number was left at its
        /// former value while the caller was told the write had succeeded. Both are resolved
        /// here before the general conversion is reached.
        /// </remarks>
        /// <param name="value">
        /// The value to convert. Never null.
        /// </param>
        /// <param name="targetType">
        /// The type to which the value should be converted. Must not be null.
        /// </param>
        /// <param name="converted">
        /// The converted value, when the method returns true.
        /// </param>
        /// <returns>
        /// True if the value could be converted and should be assigned, false if the property
        /// is to keep the value it has.
        /// </returns>
        private static bool TryConvertValue(object value, Type targetType, out object converted)
        {
            converted = null;

            var underlyingType = Nullable.GetUnderlyingType(targetType);
            var type = underlyingType ?? targetType;

            // an empty entry is how a selection submits "nothing chosen". A property that can
            // hold null is cleared by it; one that cannot keeps what it has, because there is
            // no value to put there and a zero would be a statement the caller never made
            if (type.IsValueType && value is string text && string.IsNullOrWhiteSpace(text))
            {
                return underlyingType is not null;
            }

            if (type == typeof(Guid))
            {
                if (value is not Guid guid)
                {
                    // an entry that is not a guid names nothing that could be stored; the
                    // property keeps its value rather than being emptied by a typo
                    if (!Guid.TryParse(value.ToString()?.Trim(), out guid))
                    {
                        return false;
                    }
                }

                // the empty guid is what a selection submits for its "none" entry. It names no
                // record either, so it is treated like an empty entry
                if (guid == Guid.Empty)
                {
                    return underlyingType is not null;
                }

                converted = guid;

                return true;
            }

            converted = ConvertValue(value, type);

            return true;
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
