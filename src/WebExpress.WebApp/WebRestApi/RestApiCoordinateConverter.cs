using System;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Reads a canvas coordinate that a client may deliver as a fractional number.
    /// </summary>
    /// <remarks>
    /// Editors work in continuous canvas space: a dragged element, a size derived
    /// from a circle diameter or a zoom factor all produce fractional pixel
    /// positions. The DTOs model a position as a whole number, and the default
    /// deserializer rejects the entire payload when it meets one - so a single
    /// drag would make every following save fail. Rounding is the honest
    /// resolution: sub-pixel precision carries no meaning for a stored layout.
    /// </remarks>
    public class RestApiCoordinateConverter : JsonConverter<int>
    {
        /// <summary>
        /// Reads a coordinate, accepting a fractional number and rounding it.
        /// </summary>
        /// <param name="reader">The reader.</param>
        /// <param name="typeToConvert">The target type.</param>
        /// <param name="options">The serializer options.</param>
        /// <returns>The coordinate as a whole number.</returns>
        public override int Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        {
            if (reader.TokenType == JsonTokenType.Number)
            {
                if (reader.TryGetInt32(out var whole))
                {
                    return whole;
                }

                return (int)Math.Round(reader.GetDouble(), MidpointRounding.AwayFromZero);
            }

            // a client that stringifies its numbers stays readable as well
            if (reader.TokenType == JsonTokenType.String
                && double.TryParse(reader.GetString(), System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var parsed))
            {
                return (int)Math.Round(parsed, MidpointRounding.AwayFromZero);
            }

            if (reader.TokenType == JsonTokenType.Null)
            {
                return 0;
            }

            throw new JsonException($"Cannot read a coordinate from a {reader.TokenType} token.");
        }

        /// <summary>
        /// Writes a coordinate as a whole number.
        /// </summary>
        /// <param name="writer">The writer.</param>
        /// <param name="value">The coordinate.</param>
        /// <param name="options">The serializer options.</param>
        public override void Write(Utf8JsonWriter writer, int value, JsonSerializerOptions options)
        {
            writer.WriteNumberValue(value);
        }
    }
}
