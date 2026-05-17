using System.Text;
using System.Text.Json;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebRestApi;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents the result of a login REST API operation.
    /// </summary>
    public class RestApiSessionResult : IRestApiResult
    {
        private readonly JsonSerializerOptions _jsonOptions = new()
        {
            WriteIndented = true
        };

        /// <summary>
        /// Gets or sets whether the authentication was successful.
        /// </summary>
        public bool Success { get; set; }

        /// <summary>
        /// Gets or sets an optional authentication session identifier.
        /// </summary>
        public string SessionId { get; set; }

        /// <summary>
        /// Gets or sets a message describing the authentication result.
        /// </summary>
        public string Message { get; set; }

        /// <summary>
        /// Gets or sets the number of seconds the client should wait before
        /// submitting another login attempt.
        /// </summary>
        public int? RetryAfter { get; set; }

        /// <summary>
        /// Converts the current instance into a <see cref="IResponse"/> object.
        /// </summary>
        /// <returns>A Response object representing the result of the conversion.</returns>
        public virtual IResponse ToResponse()
        {
            // create the response payload matching the client expectations
            var data = new
            {
                success = Success,
                sessionId = SessionId,
                message = Message,
                retryAfter = RetryAfter
            };

            var jsonData = JsonSerializer.Serialize(data, _jsonOptions);
            var content = Encoding.UTF8.GetBytes(jsonData);

            if (Success)
            {
                // return ok response for successful authentication
                return new ResponseOK
                {
                    Content = content
                }
                    .AddHeaderContentType("application/json");
            }

            if (RetryAfter.HasValue && RetryAfter.Value > 0)
            {
                // return bad request response if rate limit is reached
                return new ResponseBadRequest
                {
                    Content = content
                }
                    .AddHeaderContentType("application/json");
            }

            // return unauthorized response for invalid credentials
            var response = new ResponseUnauthorized
            {
                Content = content
            }
                .AddHeaderContentType("application/json");

            response.Header.WWWAuthenticate = false;

            return response;
        }
    }
}