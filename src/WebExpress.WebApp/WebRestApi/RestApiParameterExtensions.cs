using System;
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

        /// <summary>
        /// Gets or sets the largest page a client may request from a paged endpoint.
        /// </summary>
        /// <remarks>
        /// The page size is a query parameter; unbounded, "l=2147483647" turned one request into a
        /// dump of the whole data set - on endpoints that answer every signed-in caller.
        /// </remarks>
        public static int MaxPageSize { get; set; } = 500;

        /// <summary>
        /// Reads a page size, kept between one and <see cref="MaxPageSize"/>.
        /// </summary>
        /// <param name="request">The request.</param>
        /// <param name="name">The parameter name.</param>
        /// <param name="defaultValue">The size without a parameter.</param>
        /// <returns>The page size.</returns>
        public static int ParsePageSize(this IRequest request, string name, int defaultValue)
        {
            return Math.Clamp(request.ParseIntParameter(name, defaultValue), 1, Math.Max(1, MaxPageSize));
        }

        /// <summary>
        /// Reads a zero-based page number, never below zero.
        /// </summary>
        /// <param name="request">The request.</param>
        /// <param name="name">The parameter name.</param>
        /// <returns>The page number.</returns>
        public static int ParsePageNumber(this IRequest request, string name)
        {
            return Math.Max(0, request.ParseIntParameter(name, 0));
        }
    }
}
