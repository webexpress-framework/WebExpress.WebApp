using System;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebMessageQueue
{
    /// <summary>
    /// Provides extension methods for <see cref="IMessage"/> instances.
    /// </summary>
    public static class MessageExtensions
    {
        /// <summary>
        /// Serializes the message instance into a JSON string using
        /// <see cref="System.Text.Json"/> with default serialization options.
        /// </summary>
        /// <param name="message">
        /// The message instance to serialize. Must not be <c>null</c>.
        /// </param>
        /// <returns>
        /// A JSON string representing the message.
        /// </returns>
        /// <exception cref="ArgumentNullException">
        /// Thrown when <paramref name="message"/> is <c>null</c>.
        /// </exception>
        public static string ToJson(this IMessage message)
        {
            if (message == null)
            {
                throw new ArgumentNullException(nameof(message));
            }

            var options = new JsonSerializerOptions
            {
                WriteIndented = false,
                DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
            };

            return JsonSerializer.Serialize(message, options);
        }
    }
}