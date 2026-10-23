using System.Linq;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace WebExpress.WebApp.WebCollaboration
{
    /// <summary>
    /// Compares JSON values the way the client's canonical serialization does: object keys in
    /// any order, numbers by value.
    /// </summary>
    internal static class Canonical
    {
        /// <summary>
        /// Determines whether two JSON values are equal.
        /// </summary>
        /// <param name="a">The first value; null stands for JSON null.</param>
        /// <param name="b">The second value.</param>
        /// <returns>True if both are equal.</returns>
        public static bool Equal(JsonNode a, JsonNode b)
        {
            if (a is null || b is null)
            {
                return a is null && b is null;
            }

            switch (a)
            {
                case JsonObject x when b is JsonObject y:
                    return x.Count == y.Count && x.All(p => y.TryGetPropertyValue(p.Key, out var other) && Equal(p.Value, other));
                case JsonArray x when b is JsonArray y:
                    return x.Count == y.Count && x.Select((v, i) => Equal(v, y[i])).All(e => e);
                case JsonValue x when b is JsonValue y:
                    var kind = x.GetValueKind();

                    if (kind != y.GetValueKind())
                    {
                        return false;
                    }

                    return kind switch
                    {
                        JsonValueKind.Number => Number(x) == Number(y),
                        JsonValueKind.String => x.GetValue<string>() == y.GetValue<string>(),
                        _ => true
                    };
                default:
                    return false;
            }
        }

        /// <summary>
        /// Reads a JSON number whether it was parsed or created from a CLR value.
        /// </summary>
        /// <param name="value">The number.</param>
        /// <returns>The value as a double, as JavaScript holds every number.</returns>
        public static double Number(JsonValue value)
        {
            return value.TryGetValue<double>(out var number)
                ? number
                : double.Parse(value.ToJsonString(), System.Globalization.CultureInfo.InvariantCulture);
        }
    }
}
