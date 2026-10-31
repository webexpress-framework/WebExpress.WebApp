using WebExpress.WebCore.WebMessage;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Provides helper methods for safely parsing query parameters from a request.
    /// </summary>
    internal static class RestApiParameterExtensions
    {
        /// <summary>
        /// Parses an integer parameter from the given <paramref name="request"/>. If the
        /// parameter is missing, empty or not a valid integer, the supplied
        /// <paramref name="defaultValue"/> is returned. This avoids a
        /// <see cref="System.FormatException"/> when the client sends non-numeric input.
        /// </summary>
        /// <param name="request">The request to read from.</param>
        /// <param name="name">The name of the parameter.</param>
        /// <param name="defaultValue">The default value if parsing fails.</param>
        /// <returns>The parsed integer value or <paramref name="defaultValue"/>.</returns>
        public static int ParseIntParameter(this IRequest request, string name, int defaultValue)
        {
            var raw = request?.GetParameter(name)?.Value;

            if (int.TryParse(raw, out var value))
            {
                return value;
            }

            return defaultValue;
        }
    }
}
