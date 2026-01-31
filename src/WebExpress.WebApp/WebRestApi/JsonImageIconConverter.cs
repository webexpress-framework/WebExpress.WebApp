using System;
using System.Text.Json;
using System.Text.Json.Serialization;
using WebExpress.WebCore.WebIcon;
using WebExpress.WebUI.WebIcon;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Converts between ImageIcon objects and their JSON string representations.
    /// </summary>
    public class JsonImageIconConverter : JsonConverter<IIcon>
    {
        /// <summary>
        /// Reads and converts a JSON string value to an ImageIcon instance.
        /// </summary>
        /// <param name="reader">
        /// The reader to read the JSON value from. The reader must be positioned 
        /// at a JSON string token representing the URI endpoint for the image icon.
        /// </param>
        /// <param name="typeToConvert">
        /// The type of the object to convert. This parameter is ignored by this implementation.
        /// </param>
        /// <param name="options">
        /// Options to control the behavior of the deserialization. This parameter is not 
        /// used by this implementation.
        /// </param>
        /// <returns>
        /// An ImageIcon instance created from the JSON string value.
        /// </returns>
        /// <exception cref="JsonException">
        /// Thrown if the current JSON token is not a string.
        /// </exception>
        public override ImageIcon Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        {
            // JSON contains only a string → convert directly into an ImageIcon
            if (reader.TokenType == JsonTokenType.String)
            {
                var uri = reader.GetString();
                return ImageIcon.FromString(uri);
            }

            throw new JsonException("Expected string for ImageIcon");
        }

        /// <summary>
        /// Writes the JSON representation of an ImageIcon object as a 
        /// string value containing its URI.
        /// </summary>
        /// <param name="writer">
        /// The Utf8JsonWriter to which the JSON value will be written. Cannot be null.
        /// </param>
        /// <param name="value">
        /// The ImageIcon instance to convert to JSON. If null, a null value is written.
        /// </param>
        /// <param name="options">
        /// Options to control the behavior of the JSON serialization. This parameter is not used 
        /// by this method but is required by the interface.
        /// </param>
        public override void Write(Utf8JsonWriter writer, IIcon value, JsonSerializerOptions options)
        {
            if (value is ImageIcon icon)
            {
                writer.WriteStringValue(icon?.Uri?.ToString());
            }
            else
            {
                writer.WriteNullValue();
            }
        }
    }
}
