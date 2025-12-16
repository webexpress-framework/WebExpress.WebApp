using System.Collections.Generic;
using System.Text.Json;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Provides extension methods for converting JSON elements to .NET payload objects.
    /// </summary>
    /// <remarks>This class contains static methods that facilitate the transformation of
    /// System.Text.Json.JsonElement instances into commonly used .NET types, such as dictionaries, lists, and primitive
    /// values. It is intended to simplify working with dynamic or loosely-typed JSON data in .NET
    /// applications.</remarks>
    public static class JsonExtensionsPayload
    {
        /// <summary>
        /// Converts a <see cref="JsonElement"/> to a corresponding .NET object representation suitable for use as a
        /// general-purpose payload.
        /// </summary>
        /// <param name="element">
        /// The <see cref="JsonElement"/> to convert to a .NET object. Must represent a valid JSON value.
        /// </param>
        /// <returns>
        /// An object representing the JSON value: a <see cref="Dictionary{string, object}"/> for JSON objects, a <see
        /// cref="List{object}"/> for arrays, a <see cref="string"/> for JSON strings, a <see cref="long"/> or <see
        /// cref="double"/> for numbers, a <see cref="bool"/> for booleans, or <see langword="null"/> for null or
        /// undefined values.
        /// </returns>
        public static object ToPayload(this JsonElement element)
        {
            switch (element.ValueKind)
            {
                case JsonValueKind.Object:
                    var dict = new RestApiCrudFormData();
                    foreach (var prop in element.EnumerateObject())
                    {
                        dict[prop.Name] = ToPayload(prop.Value);
                    }
                    return dict;

                case JsonValueKind.Array:
                    var list = new List<object>();
                    foreach (var item in element.EnumerateArray())
                    {
                        list.Add(ToPayload(item));
                    }
                    return list;

                case JsonValueKind.String:
                    return element.GetString();

                case JsonValueKind.Number:
                    return element.TryGetInt64(out var l) ? l : element.GetDouble();

                case JsonValueKind.True:
                case JsonValueKind.False:
                    return element.GetBoolean();

                case JsonValueKind.Null:
                case JsonValueKind.Undefined:
                    return null;

                default:
                    return null;
            }
        }
    }
}
