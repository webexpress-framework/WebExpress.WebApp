using System;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebAttribute
{
    /// <summary>
    /// Provides a custom JSON converter for serializing objects that implement the <see
    /// cref="IRestTableColumnTemplate"/> interface.
    /// </summary>
    public class RestTableColumnTemplateJsonConverter : JsonConverter<IRestTableColumnTemplate>
    {
        /// <summary>
        /// Throws a <see cref="NotSupportedException"/> to indicate that deserialization 
        /// is not supported for this type.
        /// </summary>
        /// <param name="reader">
        /// A reference to the <see cref="Utf8JsonReader"/> providing the JSON data to 
        /// read. This parameter is not used.
        /// </param>
        /// <param name="typeToConvert">
        /// The type of object to convert from JSON. This parameter is not used.
        /// </param>
        /// <param name="options">
        /// Options to control the behavior of the JSON serializer. This parameter is not used.
        /// </param>
        /// <returns>
        /// This method does not return a value; it always throws a <see cref="NotSupportedException"/>.
        /// </returns>
        /// <exception cref="NotSupportedException">
        /// Thrown in all cases to indicate that deserialization is not supported.
        /// </exception>
        public override IRestTableColumnTemplate Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        {
            throw new NotSupportedException("Deserialization not supported.");
        }

        /// <summary>
        /// Writes the JSON representation of the specified table column template 
        /// to the provided writer.
        /// </summary>
        /// <param name="writer">
        /// The writer to which the JSON output will be written.
        /// </param>
        /// <param name="value">
        /// The table column template to serialize to JSON. Cannot be null.
        /// </param>
        /// <param name="options">
        /// Options to control the behavior of the JSON serialization.
        /// </param>
        public override void Write(Utf8JsonWriter writer, IRestTableColumnTemplate value, JsonSerializerOptions options)
        {
            using var doc = JsonDocument.Parse(value.ToJson());
            doc.RootElement.WriteTo(writer);
        }
    }
}
