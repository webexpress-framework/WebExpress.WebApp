using System;
using System.Text.Json;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Provides the same typed field access for partial updates and form binding.
    /// </summary>
    public static class RestApiCrudFormDataFieldExtensions
    {
        /// <summary>
        /// Reads a field without modifying the submitted payload.
        /// </summary>
        /// <typeparam name="T">The requested value type.</typeparam>
        /// <param name="fields">The submitted payload.</param>
        /// <param name="name">The case-insensitive field name.</param>
        /// <returns>The submission state, converted value and validation error.</returns>
        public static RestApiFormField<T> TryRead<T>(this RestApiCrudFormData fields, string name)
        {
            ArgumentNullException.ThrowIfNull(fields);
            ArgumentException.ThrowIfNullOrEmpty(name);
            if (!fields.TryGetValue(name, out var raw)) return new(RestApiFormFieldState.Missing);
            if (raw is JsonElement { ValueKind: JsonValueKind.Array } array)
            {
                try
                {
                    return new(RestApiFormFieldState.Valid, array.Deserialize<T>());
                }
                catch (Exception exception) when (exception is JsonException or NotSupportedException)
                {
                    return new(RestApiFormFieldState.Invalid, Error: $"Field '{name}' cannot be converted to {typeof(T).Name}.");
                }
            }
            if (raw is JsonElement element)
            {
                raw = element.ValueKind switch
                {
                    JsonValueKind.Null => null,
                    JsonValueKind.String => element.GetString(),
                    _ => element.ToString()
                };
            }
            var type = Nullable.GetUnderlyingType(typeof(T)) ?? typeof(T);
            if (raw is null || raw is string text && string.IsNullOrWhiteSpace(text) ||
                type == typeof(Guid) && Guid.TryParse(raw?.ToString(), out var guid) && guid == Guid.Empty)
            {
                return new(RestApiFormFieldState.Empty);
            }
            try
            {
                if (RestApiCrudFormDataExtensions.TryConvertValue(raw, typeof(T), out var converted))
                {
                    return new(RestApiFormFieldState.Valid, (T)converted);
                }
            }
            catch (Exception exception) when (exception is FormatException or InvalidCastException or OverflowException or ArgumentException)
            {
                return new(RestApiFormFieldState.Invalid, Error: $"Field '{name}' cannot be converted to {type.Name}.");
            }
            return new(RestApiFormFieldState.Invalid, Error: $"Field '{name}' cannot be converted to {type.Name}.");
        }

        /// <summary>
        /// Removes a field so subsequent binding cannot process it a second time.
        /// </summary>
        /// <typeparam name="T">The requested value type.</typeparam>
        /// <param name="fields">The submitted payload.</param>
        /// <param name="name">The case-insensitive field name.</param>
        /// <returns>The submission state, converted value and validation error.</returns>
        public static RestApiFormField<T> Detach<T>(this RestApiCrudFormData fields, string name)
        {
            var result = fields.TryRead<T>(name);
            fields.Remove(name);
            return result;
        }

        /// <summary>
        /// Reads an optional reference, treating an empty GUID as explicit removal.
        /// </summary>
        /// <param name="fields">The submitted payload.</param>
        /// <param name="name">The case-insensitive field name.</param>
        /// <returns>The optional reference and submission state.</returns>
        public static RestApiFormField<Guid?> ReadOptionalGuid(this RestApiCrudFormData fields, string name) => fields.TryRead<Guid?>(name);
    }
}
